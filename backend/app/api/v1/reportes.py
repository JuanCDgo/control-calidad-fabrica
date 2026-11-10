from typing import List, Optional
from fastapi import APIRouter, Depends, Form, File, UploadFile, Query, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.models.entities import ReporteCalidad, Sector, ModeloMueble
from app.schemas.dtos import ReporteResponse
from app.services.sync_service import registrar_reporte_idempotente

router = APIRouter(prefix="/reportes", tags=["Reportes de Calidad"])


def _serialize_reporte(rep: ReporteCalidad) -> ReporteResponse:
    modelo = rep.modelo
    sector = rep.sector
    if modelo is not None:
        cat_id = modelo.categoria_id
        cat_nombre = modelo.categoria.nombre if modelo.categoria else "Sin categoría"
        mod_nombre = modelo.nombre
        mod_codigo = modelo.codigo
    else:
        cat_id = None
        cat_nombre = "Otro / Prototipo"
        mod_nombre = f"Prototipo: {rep.modelo_manual}" if rep.modelo_manual else "Prototipo sin nombre"
        mod_codigo = "PROTOTIPO"

    return ReporteResponse(
        id=rep.id,
        client_uuid=rep.client_uuid,
        modelo_id=rep.modelo_id,
        modelo_manual=rep.modelo_manual,
        categoria_id=cat_id,
        categoria_nombre=cat_nombre,
        sector_id=rep.sector_id,
        descripcion_defecto=rep.descripcion_defecto,
        cantidad_afectada=rep.cantidad_afectada,
        foto_path=rep.foto_path,
        fecha_captura_local=rep.fecha_captura_local,
        fecha_sincronizacion=rep.fecha_sincronizacion,
        modelo_nombre=mod_nombre,
        modelo_codigo=mod_codigo,
        sector_nombre=sector.nombre if sector else None,
        es_ejemplo=rep.es_ejemplo,
    )


@router.post("/", response_model=ReporteResponse, status_code=status.HTTP_201_CREATED)
async def crear_o_sincronizar_reporte(
    client_uuid: str = Form(..., description="UUID v4 generado en la PWA del celular"),
    sector_id: int = Form(..., description="ID del sector"),
    descripcion_defecto: str = Form(..., description="Descripción detallada del defecto"),
    cantidad_afectada: str = Form(..., description="Cantidad de material afectado (texto libre)"),
    fecha_captura_local: str = Form(..., description="Fecha y hora de captura en celular (GMT-3)"),
    foto: UploadFile = File(..., description="Archivo de foto capturada"),
    modelo_id: Optional[int] = Form(None, description="ID del modelo oficial (opcional si es prototipo)"),
    modelo_manual: Optional[str] = Form(None, description="Nombre del prototipo si eligió Otro / Prototipo"),
    db: Session = Depends(get_db)
):
    """
    Endpoint principal de sincronización utilizado por la PWA.
    Es 100% idempotente: si el client_uuid ya existe en el servidor por un reintento
    de conexión inestable, devuelve el reporte existente sin duplicar datos ni fotos.
    """
    foto_bytes = await foto.read()

    reporte, _ = registrar_reporte_idempotente(
        db=db,
        client_uuid=client_uuid,
        modelo_id=modelo_id,
        modelo_manual=modelo_manual,
        sector_id=sector_id,
        descripcion_defecto=descripcion_defecto,
        cantidad_afectada=cantidad_afectada,
        fecha_captura_local=fecha_captura_local,
        foto_file=foto,
        foto_bytes=foto_bytes
    )

    rep_full = (
        db.query(ReporteCalidad)
        .options(
            joinedload(ReporteCalidad.modelo).joinedload(ModeloMueble.categoria),
            joinedload(ReporteCalidad.sector),
        )
        .filter(ReporteCalidad.id == reporte.id)
        .first()
    )
    return _serialize_reporte(rep_full)


@router.get("/", response_model=List[ReporteResponse])
def listar_reportes(
    sector_id: Optional[int] = Query(None, description="Filtrar por sector"),
    categoria_id: Optional[int] = Query(None, description="Filtrar por categoría de mueble"),
    modelo_id: Optional[int] = Query(None, description="Filtrar por modelo"),
    solo_prototipos: bool = Query(False, description="Filtrar solo reportes de prototipos manuales"),
    limite: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Lista los reportes de calidad recibidos para visualización en el panel PC.
    Ordenados cronológicamente desde el más reciente.
    """
    query = db.query(ReporteCalidad).options(
        joinedload(ReporteCalidad.modelo).joinedload(ModeloMueble.categoria),
        joinedload(ReporteCalidad.sector),
    )

    if sector_id:
        query = query.filter(ReporteCalidad.sector_id == sector_id)
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


@router.delete("/{reporte_id}")
def eliminar_reporte_ejemplo(reporte_id: int, db: Session = Depends(get_db)):
    """Solo permite eliminar reportes marcados como ejemplo (es_ejemplo == 1)."""
    reporte = db.query(ReporteCalidad).filter(ReporteCalidad.id == reporte_id).first()
    if not reporte:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    if reporte.es_ejemplo != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los reportes reales de producción no pueden eliminarse."
        )
    db.delete(reporte)
    db.commit()
    return {"mensaje": "Reporte de ejemplo eliminado.", "id": reporte_id}
