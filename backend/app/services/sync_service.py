from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile, status
from app.models.entities import ReporteCalidad, Sector, ModeloMueble, Encargado, TipoProblema
from app.services.storage_service import save_uploaded_photo
from app.core.timezone import get_arg_now_str
from app.core.seed_catalog import IMPACTOS_VALIDOS, ESTADOS_VALIDOS


def registrar_reporte_idempotente(
    db: Session,
    client_uuid: str,
    modelo_id: Optional[int],
    modelo_manual: Optional[str],
    sector_id: int,
    descripcion_defecto: str,
    cantidad_afectada: str,
    fecha_captura_local: str,
    encargado_id: Optional[int] = None,
    tipo_problema_id: Optional[int] = None,
    impacto: str = "DEFECTO",
    detalle_pieza: Optional[str] = None,
    accion_inmediata: Optional[str] = None,
    estado: str = "Abierto",
    foto_file: Optional[UploadFile] = None,
    foto_bytes: Optional[bytes] = None,
) -> tuple[ReporteCalidad, bool]:
    """
    Registra un reporte de forma idempotente.
    La foto es opcional; si llega archivo se valida y guarda de forma segura.
    """
    reporte_existente = db.query(ReporteCalidad).filter(
        ReporteCalidad.client_uuid == client_uuid
    ).first()

    if reporte_existente:
        return reporte_existente, False

    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El sector con ID {sector_id} no existe en la base de datos."
        )

    if encargado_id is not None:
        enc = db.query(Encargado).filter(Encargado.id == encargado_id).first()
        if not enc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El encargado con ID {encargado_id} no existe."
            )

    if tipo_problema_id is not None:
        tp = db.query(TipoProblema).filter(TipoProblema.id == tipo_problema_id).first()
        if not tp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El tipo de problema con ID {tipo_problema_id} no existe."
            )

    modelo_manual_limpio = modelo_manual.strip() if modelo_manual else None
    if modelo_id is not None:
        modelo = db.query(ModeloMueble).filter(ModeloMueble.id == modelo_id).first()
        if not modelo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El modelo de mueble con ID {modelo_id} no existe en la base de datos."
            )
        modelo_manual_limpio = None
    elif not modelo_manual_limpio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes seleccionar un producto de la lista o ingresar uno manual / general."
        )

    impacto_clean = (impacto or "DEFECTO").strip().upper()
    if impacto_clean not in IMPACTOS_VALIDOS:
        impacto_clean = "OTRO"

    estado_clean = (estado or "Abierto").strip()
    if estado_clean not in ESTADOS_VALIDOS:
        estado_clean = "Abierto"

    foto_rel_path: Optional[str] = None
    if foto_file is not None and foto_bytes:
        foto_rel_path = save_uploaded_photo(foto_file, foto_bytes)

    ahora_sync = get_arg_now_str()
    nuevo_reporte = ReporteCalidad(
        client_uuid=client_uuid,
        encargado_id=encargado_id,
        tipo_problema_id=tipo_problema_id,
        impacto=impacto_clean,
        modelo_id=modelo_id,
        modelo_manual=modelo_manual_limpio,
        detalle_pieza=detalle_pieza.strip() if detalle_pieza else None,
        sector_id=sector_id,
        descripcion_defecto=descripcion_defecto.strip(),
        cantidad_afectada=cantidad_afectada.strip(),
        accion_inmediata=accion_inmediata.strip() if accion_inmediata else None,
        estado=estado_clean,
        foto_path=foto_rel_path,
        fecha_captura_local=fecha_captura_local or ahora_sync,
        fecha_sincronizacion=ahora_sync,
        es_ejemplo=0,
        exportado_excel=0,
    )

    db.add(nuevo_reporte)
    db.commit()
    db.refresh(nuevo_reporte)

    return nuevo_reporte, True
