from typing import List, Optional
from fastapi import APIRouter, Depends, Form, File, UploadFile, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import ReporteCalidad, Sector, ModeloMueble
from app.schemas.dtos import ReporteResponse
from app.services.sync_service import registrar_reporte_idempotente

router = APIRouter(prefix="/reportes", tags=["Reportes de Calidad"])

@router.post("/", response_model=ReporteResponse, status_code=status.HTTP_201_CREATED)
async def crear_o_sincronizar_reporte(
    client_uuid: str = Form(..., description="UUID v4 generado en la PWA del celular"),
    modelo_id: int = Form(..., description="ID del modelo de mueble"),
    sector_id: int = Form(..., description="ID del sector"),
    descripcion_defecto: str = Form(..., description="Descripción detallada del defecto"),
    cantidad_afectada: str = Form(..., description="Cantidad de material afectado (texto libre)"),
    fecha_captura_local: str = Form(..., description="Fecha y hora de captura en celular (GMT-3)"),
    foto: UploadFile = File(..., description="Archivo de foto capturada"),
    db: Session = Depends(get_db)
):
    """
    Endpoint principal de sincronización utilizado por la PWA.
    Es 100% idempotente: si el client_uuid ya existe en el servidor por un reintento
    de conexión inestable, devuelve el reporte existente sin duplicar datos ni fotos.
    """
    foto_bytes = await foto.read()

    reporte, es_nuevo = registrar_reporte_idempotente(
        db=db,
        client_uuid=client_uuid,
        modelo_id=modelo_id,
        sector_id=sector_id,
        descripcion_defecto=descripcion_defecto,
        cantidad_afectada=cantidad_afectada,
        fecha_captura_local=fecha_captura_local,
        foto_file=foto,
        foto_bytes=foto_bytes
    )

    # Obtenemos los nombres de modelo y sector para la respuesta
    modelo = db.query(ModeloMueble).filter(ModeloMueble.id == reporte.modelo_id).first()
    sector = db.query(Sector).filter(Sector.id == reporte.sector_id).first()

    return ReporteResponse(
        id=reporte.id,
        client_uuid=reporte.client_uuid,
        modelo_id=reporte.modelo_id,
        sector_id=reporte.sector_id,
        descripcion_defecto=reporte.descripcion_defecto,
        cantidad_afectada=reporte.cantidad_afectada,
        foto_path=reporte.foto_path,
        fecha_captura_local=reporte.fecha_captura_local,
        fecha_sincronizacion=reporte.fecha_sincronizacion,
        modelo_nombre=modelo.nombre if modelo else None,
        sector_nombre=sector.nombre if sector else None
    )


@router.get("/", response_model=List[ReporteResponse])
def listar_reportes(
    sector_id: Optional[int] = Query(None, description="Filtrar por sector"),
    modelo_id: Optional[int] = Query(None, description="Filtrar por modelo"),
    limite: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Lista los reportes de calidad recibidos para visualización en el panel PC.
    Ordenados cronológicamente desde el más reciente.
    """
    query = db.query(ReporteCalidad)

    if sector_id:
        query = query.filter(ReporteCalidad.sector_id == sector_id)
    if modelo_id:
        query = query.filter(ReporteCalidad.modelo_id == modelo_id)

    reportes = query.order_by(ReporteCalidad.id.desc()).limit(limite).all()

    resultado = []
    for rep in reportes:
        modelo = db.query(ModeloMueble).filter(ModeloMueble.id == rep.modelo_id).first()
        sector = db.query(Sector).filter(Sector.id == rep.sector_id).first()
        resultado.append(
            ReporteResponse(
                id=rep.id,
                client_uuid=rep.client_uuid,
                modelo_id=rep.modelo_id,
                sector_id=rep.sector_id,
                descripcion_defecto=rep.descripcion_defecto,
                cantidad_afectada=rep.cantidad_afectada,
                foto_path=rep.foto_path,
                fecha_captura_local=rep.fecha_captura_local,
                fecha_sincronizacion=rep.fecha_sincronizacion,
                modelo_nombre=modelo.nombre if modelo else None,
                sector_nombre=sector.nombre if sector else None
            )
        )

    return resultado
