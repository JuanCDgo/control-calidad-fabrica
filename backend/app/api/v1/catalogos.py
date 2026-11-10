from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.timezone import get_arg_now_str
from app.models.entities import Sector, CategoriaMueble, ModeloMueble
from app.schemas.dtos import (
    CatalogosOfflineResponse,
    SectorResponse,
    CategoriaMuebleResponse,
    ModeloMuebleResponse,
)

router = APIRouter(prefix="/catalogos", tags=["Catálogos Offline"])


@router.get("/offline", response_model=CatalogosOfflineResponse)
def get_catalogos_offline(db: Session = Depends(get_db)):
    """
    Endpoint liviano que consume la PWA para cachear localmente en IndexedDB
    sectores, categorías y modelos reales activos (excluye los registros de muestra).
    """
    sectores_activos = (
        db.query(Sector)
        .filter(Sector.activo == 1)
        .order_by(Sector.nombre.asc())
        .all()
    )

    categorias_activas = (
        db.query(CategoriaMueble)
        .filter(CategoriaMueble.activo == 1, CategoriaMueble.es_ejemplo == 0)
        .order_by(CategoriaMueble.nombre.asc())
        .all()
    )

    modelos_activos = (
        db.query(ModeloMueble)
        .options(joinedload(ModeloMueble.categoria))
        .filter(ModeloMueble.activo == 1, ModeloMueble.es_ejemplo == 0)
        .order_by(ModeloMueble.nombre.asc())
        .all()
    )

    modelos_dto = []
    for m in modelos_activos:
        # Si pertenece a una categoría desactivada, tampoco mostrarlo en el celular
        if m.categoria is not None and (m.categoria.activo == 0 or m.categoria.es_ejemplo == 1):
            continue
        modelos_dto.append(
            ModeloMuebleResponse(
                id=m.id,
                nombre=m.nombre,
                categoria_id=m.categoria_id,
                categoria_nombre=m.categoria.nombre if m.categoria else "Sin categoría",
                codigo=m.codigo,
                descripcion=m.descripcion,
                es_ejemplo=m.es_ejemplo,
                activo=m.activo,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
        )

    return CatalogosOfflineResponse(
        sectores=[SectorResponse.model_validate(s) for s in sectores_activos],
        categorias=[CategoriaMuebleResponse.model_validate(c) for c in categorias_activas],
        modelos=modelos_dto,
        servidor_timestamp_gmt3=get_arg_now_str(),
    )
