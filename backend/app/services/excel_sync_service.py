import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional
import openpyxl
from openpyxl.styles import Font, Alignment
from sqlalchemy.orm import Session, joinedload

from app.core.config import CARGA_SEMANAL_DIR, UPLOADS_DIR
from app.core.timezone import get_arg_now_str
from app.models.entities import ReporteCalidad, ModeloMueble

DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
SHEET_NAME = "Desvíos y Materiales"


def _dia_semana_es(fecha_str: str) -> str:
    """Extrae el nombre del día en español desde YYYY-MM-DD HH:MM:SS."""
    if not fecha_str:
        return DIAS_ES[datetime.now().weekday()]
    try:
        dt = datetime.strptime(fecha_str[:10], "%Y-%m-%d")
        return DIAS_ES[dt.weekday()]
    except ValueError:
        return DIAS_ES[datetime.now().weekday()]


def _resolve_upload_file(foto_path: Optional[str]) -> Optional[Path]:
    if not foto_path:
        return None
    rel = foto_path.lstrip("/").replace("uploads/", "", 1)
    candidate = UPLOADS_DIR / rel
    return candidate if candidate.exists() and candidate.is_file() else None


def _find_next_empty_row(ws) -> int:
    """Encuentra la primera fila vacía (desde la 4) en la hoja 'Desvíos y Materiales'."""
    for r in range(4, ws.max_row + 1):
        dia = ws.cell(r, 2).value
        tipo = ws.cell(r, 4).value
        desc = ws.cell(r, 9).value
        if not any(v is not None and str(v).strip() != "" for v in (dia, tipo, desc)):
            return r
    return max(ws.max_row + 1, 4)


def _ensure_foto_header(ws) -> None:
    """Agrega encabezado 'Foto' en la columna L (fila 3) copiando el estilo de la columna K."""
    cell_l3 = ws.cell(3, 12)
    if not cell_l3.value:
        cell_k3 = ws.cell(3, 11)
        cell_l3.value = "Foto"
        if cell_k3.has_style:
            cell_l3.font = cell_k3.font.copy()
            cell_l3.fill = cell_k3.fill.copy()
            cell_l3.alignment = cell_k3.alignment.copy()
            cell_l3.border = cell_k3.border.copy()
        ws.column_dimensions["L"].width = 14


def _resolve_target_excel(rep: ReporteCalidad) -> Optional[Path]:
    if rep.encargado and rep.encargado.archivo_excel:
        return CARGA_SEMANAL_DIR / rep.encargado.archivo_excel

    # Fallback inteligente por sector si no eligieron encargado
    sector_nom = (rep.sector.nombre if rep.sector else "").lower()
    if "maquin" in sector_nom:
        return CARGA_SEMANAL_DIR / "Encargado_2_Maquinado.xlsx"
    if "termina" in sector_nom or "lijad" in sector_nom or "tinta" in sector_nom:
        return CARGA_SEMANAL_DIR / "Encargado_3_Terminacion.xlsx"
    if "living" in sector_nom or "colchon" in sector_nom:
        return CARGA_SEMANAL_DIR / "Encargado_4_Living_PropiaPC.xlsx"
    return CARGA_SEMANAL_DIR / "Encargado_1_Armado.xlsx"


def exportar_reportes_a_planillas(
    db: Session,
    reporte_ids: Optional[List[int]] = None,
) -> dict:
    """
    Vuelca cada reporte real pendiente (exportado_excel == 0) en la hoja 'Desvíos y Materiales'
    de la planilla Excel del encargado correspondiente, copiando la foto con nombre corto
    en Carga_Semanal/Fotos/ para que el link funcione offline.
    """
    CARGA_SEMANAL_DIR.mkdir(parents=True, exist_ok=True)
    fotos_dir = CARGA_SEMANAL_DIR / "Fotos"
    fotos_dir.mkdir(parents=True, exist_ok=True)

    query = db.query(ReporteCalidad).options(
        joinedload(ReporteCalidad.encargado),
        joinedload(ReporteCalidad.sector),
        joinedload(ReporteCalidad.tipo_problema),
        joinedload(ReporteCalidad.modelo).joinedload(ModeloMueble.categoria),
    ).filter(ReporteCalidad.es_ejemplo == 0)

    if reporte_ids:
        query = query.filter(ReporteCalidad.id.in_(reporte_ids))

    reportes = query.order_by(ReporteCalidad.id.asc()).all()

    exportados = 0
    omitidos = 0
    errores: List[str] = []
    archivos_actualizados = set()
    now_str = get_arg_now_str()

    # Agrupar por archivo Excel destino para abrir/guardar una vez por archivo
    lotes: dict[Path, List[ReporteCalidad]] = {}
    for rep in reportes:
        if rep.exportado_excel == 1:
            omitidos += 1
            continue
        target_path = _resolve_target_excel(rep)
        if not target_path or not target_path.exists():
            nombre_arch = target_path.name if target_path else "sin archivo"
            errores.append(
                f"Reporte #{rep.id}: no existe la planilla '{nombre_arch}' en {CARGA_SEMANAL_DIR}."
            )
            continue
        lotes.setdefault(target_path, []).append(rep)

    for target_path, reps_lote in lotes.items():
        try:
            wb = openpyxl.load_workbook(target_path)
        except PermissionError:
            errores.append(
                f"Cerrá el archivo '{target_path.name}' en Excel antes de enviar los reportes."
            )
            continue
        except Exception as exc:
            errores.append(f"No se pudo abrir '{target_path.name}': {exc}")
            continue

        if SHEET_NAME not in wb.sheetnames:
            errores.append(
                f"'{target_path.name}' no tiene la pestaña '{SHEET_NAME}'."
            )
            continue

        ws = wb[SHEET_NAME]
        _ensure_foto_header(ws)

        for rep in reps_lote:
            row_idx = _find_next_empty_row(ws)
            producto_nombre = (
                rep.modelo.nombre
                if rep.modelo is not None
                else (rep.modelo_manual or "General")
            )
            tipo_nombre = (
                rep.tipo_problema.nombre
                if rep.tipo_problema is not None
                else "OTRO / CLIMA LABORAL"
            )
            sector_nombre = rep.sector.nombre if rep.sector else "Otro"

            ws.cell(row_idx, 1, row_idx - 3)
            ws.cell(row_idx, 2, _dia_semana_es(rep.fecha_captura_local))
            ws.cell(row_idx, 3, sector_nombre)
            ws.cell(row_idx, 4, tipo_nombre)
            ws.cell(row_idx, 5, rep.impacto or "DEFECTO")
            ws.cell(row_idx, 6, producto_nombre)
            ws.cell(row_idx, 7, rep.detalle_pieza or "-")
            ws.cell(row_idx, 8, rep.cantidad_afectada)
            ws.cell(row_idx, 9, rep.descripcion_defecto)
            ws.cell(row_idx, 10, rep.accion_inmediata or "-")
            ws.cell(row_idx, 11, rep.estado or "Abierto")

            foto_cell = ws.cell(row_idx, 12)
            src_photo = _resolve_upload_file(rep.foto_path)
            if src_photo is not None:
                short_name = f"P-{rep.id:03d}{src_photo.suffix.lower() or '.jpg'}"
                dest_photo = fotos_dir / short_name
                shutil.copy2(src_photo, dest_photo)
                foto_cell.value = "Ver Foto"
                foto_cell.hyperlink = f"Fotos/{short_name}"
                foto_cell.font = Font(color="0563C1", underline="single")
                foto_cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                foto_cell.value = "Sin foto"
                foto_cell.alignment = Alignment(horizontal="center", vertical="center")

        try:
            wb.save(target_path)
        except PermissionError:
            errores.append(
                f"Cerrá el archivo '{target_path.name}' en Excel para poder guardarlo."
            )
            continue
        except Exception as exc:
            errores.append(f"Error guardando '{target_path.name}': {exc}")
            continue

        for rep in reps_lote:
            rep.exportado_excel = 1
            rep.exportado_archivo = target_path.name
            rep.exportado_at = now_str
            exportados += 1
        archivos_actualizados.add(target_path.name)

    db.commit()
    return {
        "exportados": exportados,
        "omitidos": omitidos,
        "archivos_actualizados": sorted(archivos_actualizados),
        "errores": errores,
        "carga_dir": str(CARGA_SEMANAL_DIR),
    }
