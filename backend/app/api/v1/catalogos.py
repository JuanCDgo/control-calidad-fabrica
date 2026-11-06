from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.timezone import get_arg_now_str
from app.models.entities import Sector, ModeloMueble
from app.schemas.dtos import CatalogosOfflineResponse, SectorResponse, ModeloMuebleResponse

router = APIRouter(prefix="/catalogos", tags=["Catálogos Offline"])

@router.get("/offline", response_model=CatalogosOfflineResponse)
def get_catalogos_offline(db: Session = Depends(get_db)):
    """
    Endpoint liviano que consume la PWA al recuperar conexión para
    cachear localmente en IndexedDB los sectores y modelos activos.
    """
    sectores_activos = db.query(Sector).filter(Sector.activo == 1).order_by(Sector.nombre.asc()).all()
    modelos_activos = db.query(ModeloMueble).filter(ModeloMueble.activo == 1).order_by(ModeloMueble.nombre.asc()).all()

    return CatalogosOfflineResponse(
        sectores=[SectorResponse.model_validate(s) for s in sectores_activos],
        modelos=[ModeloMuebleResponse.model_validate(m) for m in modelos_activos],
        servidor_timestamp_gmt3=get_arg_now_str()
    )
