from typing import List, Optional
from fastapi import APIRouter, Depends, Form, File, UploadFile, Query, HTTPException, Body, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import CARGA_SEMANAL_DIR
from app.core.database import get_db
from app.core.seed_catalog import IMPACTOS_VALIDOS, ESTADOS_VALIDOS
from app.core.timezone import get_arg_now_str
from app.models.entities import ReporteCalidad, Sector, ModeloMueble, Encargado, TipoProblema
from app.schemas.dtos import (
    ReporteResponse,
    ReporteUpdate,
    ExportarPlanillasRequest,
    ExportarPlanillasResponse,
)
from app.services.sync_service import registrar_reporte_idempotente
from app.services.excel_sync_service import exportar_reportes_a_planillas

router = APIRouter(prefix="/reportes", tags=["Reportes de Calidad"])


def _serialize_reporte(rep: ReporteCalidad) -> ReporteResponse:
    modelo = rep.modelo
    sector = rep.sector
    encargado = rep.encargado
    tipo_problema = rep.tipo_problema

    if modelo is not None:
        cat_id = modelo.categoria_id
        cat_nombre = modelo.categoria.nombre if modelo.categoria else "Sin categoría"
        mod_nombre = modelo.nombre
        mod_codigo = modelo.codigo
    else:
        cat_id = None
        cat_nombre = "Otro / General"
        mod_nombre = rep.modelo_manual or "General"
        mod_codigo = "MANUAL"

    return ReporteResponse(
        id=rep.id,
        client_uuid=rep.client_uuid,
        encargado_id=rep.encargado_id,
        encargado_nombre=encargado.nombre if encargado else None,
        encargado_archivo=encargado.archivo_excel if encargado else None,
        tipo_problema_id=rep.tipo_problema_id,
        tipo_problema_nombre=tipo_problema.nombre if tipo_problema else None,
        impacto=rep.impacto or "DEFECTO",
        modelo_id=rep.modelo_id,
        modelo_manual=rep.modelo_manual,
        categoria_id=cat_id,
        categoria_nombre=cat_nombre,
        detalle_pieza=rep.detalle_pieza,
        sector_id=rep.sector_id,
        descripcion_defecto=rep.descripcion_defecto,
        cantidad_afectada=rep.cantidad_afectada,
        accion_inmediata=rep.accion_inmediata,
        estado=rep.estado or "Abierto",
        foto_path=rep.foto_path,
        foto_link_corto=f"/f/{rep.id}" if rep.foto_path else None,
        fecha_captura_local=rep.fecha_captura_local,
        fecha_sincronizacion=rep.fecha_sincronizacion,
        modelo_nombre=mod_nombre,
        modelo_codigo=mod_codigo,
        sector_nombre=sector.nombre if sector else None,
        es_ejemplo=rep.es_ejemplo,
        exportado_excel=rep.exportado_excel,
        exportado_archivo=rep.exportado_archivo,
        exportado_at=rep.exportado_at,
    )


def _load_reporte_full(db: Session, reporte_id: int) -> Optional[ReporteCalidad]:
    return (
        db.query(ReporteCalidad)
        .options(
            joinedload(ReporteCalidad.modelo).joinedload(ModeloMueble.categoria),
            joinedload(ReporteCalidad.sector),
            joinedload(ReporteCalidad.encargado),
            joinedload(ReporteCalidad.tipo_problema),
        )
        .filter(ReporteCalidad.id == reporte_id)
        .first()
    )


@router.get("/planillas-disponibles")
def listar_planillas_disponibles():
    """Lista los archivos Excel de encargados detectados en Carga_Semanal."""
    if not CARGA_SEMANAL_DIR.exists():
        return {"carga_dir": str(CARGA_SEMANAL_DIR), "archivos": []}
    archivos = sorted(
        p.name
        for p in CARGA_SEMANAL_DIR.glob("*.xlsx")
        if not p.name.startswith("~$")
    )
    return {"carga_dir": str(CARGA_SEMANAL_DIR), "archivos": archivos}


@router.post("/exportar-planillas", response_model=ExportarPlanillasResponse)
def exportar_a_planillas_encargados(
    body: Optional[ExportarPlanillasRequest] = Body(default=None),
    db: Session = Depends(get_db),
):
    """Vuelca los reportes reales pendientes a la planilla Excel del encargado correspondiente."""
    ids = body.reporte_ids if body else None
    resultado = exportar_reportes_a_planillas(db, reporte_ids=ids)
    return ExportarPlanillasResponse(**resultado)


@router.post("/", response_model=ReporteResponse, status_code=status.HTTP_201_CREATED)
async def crear_o_sincronizar_reporte(
    client_uuid: str = Form(..., description="UUID v4 generado en la PWA del celular"),
    sector_id: int = Form(..., description="ID del sector"),
    descripcion_defecto: str = Form(..., description="Descripción detallada del problema"),
    cantidad_afectada: str = Form(..., description="Cantidad de material afectado (texto libre)"),
    fecha_captura_local: str = Form(..., description="Fecha y hora de captura en celular (GMT-3)"),
    foto: Optional[UploadFile] = File(None, description="Archivo de foto (opcional)"),
    modelo_id: Optional[int] = Form(None, description="ID del producto oficial"),
    modelo_manual: Optional[str] = Form(None, description="Producto manual o general"),
    encargado_id: Optional[int] = Form(None, description="ID del encargado responsable"),
    tipo_problema_id: Optional[int] = Form(None, description="ID del tipo de problema"),
    impacto: str = Form("DEFECTO", description="FALTA | SOBRA | DEFECTO | OTRO"),
    detalle_pieza: Optional[str] = Form(None, description="Detalle de pieza o insumo"),
    accion_inmediata: Optional[str] = Form(None, description="Acción inmediata tomada"),
    estado: str = Form("Abierto", description="Abierto | En Proceso | Resuelto"),
    db: Session = Depends(get_db)
):
    """
    Endpoint principal de sincronización utilizado por la PWA.
    100% idempotente por client_uuid y con foto opcional.
    """
    foto_bytes: Optional[bytes] = None
    if foto is not None:
        raw = await foto.read()
        if raw:
            foto_bytes = raw

    reporte, _ = registrar_reporte_idempotente(
        db=db,
        client_uuid=client_uuid,
        modelo_id=modelo_id,
        modelo_manual=modelo_manual,
        sector_id=sector_id,
        descripcion_defecto=descripcion_defecto,
        cantidad_afectada=cantidad_afectada,
        fecha_captura_local=fecha_captura_local,
        encargado_id=encargado_id,
        tipo_problema_id=tipo_problema_id,
        impacto=impacto,
        detalle_pieza=detalle_pieza,
        accion_inmediata=accion_inmediata,
        estado=estado,
        foto_file=foto if foto_bytes else None,
        foto_bytes=foto_bytes,
    )

    rep_full = _load_reporte_full(db, reporte.id)
    return _serialize_reporte(rep_full)


@router.get("/", response_model=List[ReporteResponse])
def listar_reportes(
    sector_id: Optional[int] = Query(None, description="Filtrar por sector"),
    encargado_id: Optional[int] = Query(None, description="Filtrar por encargado"),
    tipo_problema_id: Optional[int] = Query(None, description="Filtrar por tipo de problema"),
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    categoria_id: Optional[int] = Query(None, description="Filtrar por categoría de mueble"),
    modelo_id: Optional[int] = Query(None, description="Filtrar por modelo"),
    solo_prototipos: bool = Query(False, description="Filtrar solo reportes manuales/generales"),
    solo_pendientes_excel: bool = Query(False, description="Solo reportes aún no enviados a planillas"),
    limite: int = Query(300, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Lista los reportes recibidos para visualización y edición en el panel PC."""
    query = db.query(ReporteCalidad).options(
        joinedload(ReporteCalidad.modelo).joinedload(ModeloMueble.categoria),
        joinedload(ReporteCalidad.sector),
        joinedload(ReporteCalidad.encargado),
        joinedload(ReporteCalidad.tipo_problema),
    )

    if sector_id:
        query = query.filter(ReporteCalidad.sector_id == sector_id)
    if encargado_id:
        query = query.filter(ReporteCalidad.encargado_id == encargado_id)
    if tipo_problema_id:
        query = query.filter(ReporteCalidad.tipo_problema_id == tipo_problema_id)
    if estado:
        query = query.filter(ReporteCalidad.estado == estado)
    if solo_pendientes_excel:
        query = query.filter(ReporteCalidad.exportado_excel == 0, ReporteCalidad.es_ejemplo == 0)
    if solo_prototipos:
        query = query.filter(ReporteCalidad.modelo_id.is_(None))
    elif modelo_id:
        query = query.filter(ReporteCalidad.modelo_id == modelo_id)
    elif categoria_id:
        query = query.join(ModeloMueble, ReporteCalidad.modelo_id == ModeloMueble.id).filter(
            ModeloMueble.categoria_id == categoria_id
        )

    reportes = query.order_by(ReporteCalidad.id.desc()).limit(limite).all()
    return [_serialize_reporte(rep) for rep in reportes]


@router.put("/{reporte_id}", response_model=ReporteResponse)
def actualizar_reporte(
    reporte_id: int,
    datos: ReporteUpdate,
    db: Session = Depends(get_db),
):
    """Permite editar cualquier campo de un reporte desde Admin PC (estado, acción, encargado, etc.)."""
    rep = db.query(ReporteCalidad).filter(ReporteCalidad.id == reporte_id).first()
    if not rep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")

    fields = datos.model_fields_set

    if "encargado_id" in fields:
        if datos.encargado_id is not None:
            if not db.query(Encargado).filter(Encargado.id == datos.encargado_id).first():
                raise HTTPException(status_code=404, detail="El encargado seleccionado no existe.")
        rep.encargado_id = datos.encargado_id

    if "tipo_problema_id" in fields:
        if datos.tipo_problema_id is not None:
            if not db.query(TipoProblema).filter(TipoProblema.id == datos.tipo_problema_id).first():
                raise HTTPException(status_code=404, detail="El tipo de problema seleccionado no existe.")
        rep.tipo_problema_id = datos.tipo_problema_id

    if "sector_id" in fields and datos.sector_id is not None:
        if not db.query(Sector).filter(Sector.id == datos.sector_id).first():
            raise HTTPException(status_code=404, detail="El sector seleccionado no existe.")
        rep.sector_id = datos.sector_id

    if "modelo_id" in fields:
        if datos.modelo_id is not None:
            if not db.query(ModeloMueble).filter(ModeloMueble.id == datos.modelo_id).first():
                raise HTTPException(status_code=404, detail="El modelo seleccionado no existe.")
            rep.modelo_id = datos.modelo_id
            rep.modelo_manual = None
        else:
            rep.modelo_id = None

    if "modelo_manual" in fields and datos.modelo_manual is not None:
        clean_man = datos.modelo_manual.strip()
        if clean_man:
            rep.modelo_id = None
            rep.modelo_manual = clean_man

    if "impacto" in fields and datos.impacto:
        imp = datos.impacto.strip().upper()
        if imp in IMPACTOS_VALIDOS:
            rep.impacto = imp

    if "estado" in fields and datos.estado:
        est = datos.estado.strip()
        if est in ESTADOS_VALIDOS:
            rep.estado = est

    if "detalle_pieza" in fields:
        rep.detalle_pieza = datos.detalle_pieza.strip() if datos.detalle_pieza else None

    if "cantidad_afectada" in fields and datos.cantidad_afectada is not None:
        if not datos.cantidad_afectada.strip():
            raise HTTPException(status_code=400, detail="La cantidad afectada no puede quedar vacía.")
        rep.cantidad_afectada = datos.cantidad_afectada.strip()

    if "descripcion_defecto" in fields and datos.descripcion_defecto is not None:
        if not datos.descripcion_defecto.strip():
            raise HTTPException(status_code=400, detail="La descripción no puede quedar vacía.")
        rep.descripcion_defecto = datos.descripcion_defecto.strip()

    if "accion_inmediata" in fields:
        rep.accion_inmediata = datos.accion_inmediata.strip() if datos.accion_inmediata else None

    rep.fecha_sincronizacion = get_arg_now_str()
    db.commit()
    rep_full = _load_reporte_full(db, reporte_id)
    return _serialize_reporte(rep_full)


@router.delete("/{reporte_id}")
def eliminar_reporte(
    reporte_id: int,
    forzar: bool = Query(False, description="Confirmar eliminación de un reporte real desde Admin PC"),
    db: Session = Depends(get_db),
):
    """Elimina reportes de ejemplo o reportes reales cuando se confirma explícitamente (forzar=true)."""
    reporte = db.query(ReporteCalidad).filter(ReporteCalidad.id == reporte_id).first()
    if not reporte:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    if reporte.es_ejemplo != 1 and not forzar:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los reportes reales requieren confirmación explícita (forzar=true)."
        )
    db.delete(reporte)
    db.commit()
    return {"mensaje": "Reporte eliminado correctamente.", "id": reporte_id}
