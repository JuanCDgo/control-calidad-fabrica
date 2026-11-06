from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

# --- SECTORES ---
class SectorBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre del sector de la fábrica")

class SectorCreate(SectorBase):
    pass

class SectorUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    activo: Optional[int] = Field(None, ge=0, le=1)

class SectorResponse(SectorBase):
    id: int
    activo: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


# --- MODELOS DE MUEBLE ---
class ModeloMuebleBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150, description="Nombre del modelo de mueble")
    codigo: Optional[str] = Field(None, max_length=50, description="Código de producto o SKU")
    descripcion: Optional[str] = Field(None, max_length=500)

class ModeloMuebleCreate(ModeloMuebleBase):
    pass

class ModeloMuebleUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    codigo: Optional[str] = Field(None, max_length=50)
    descripcion: Optional[str] = Field(None, max_length=500)
    activo: Optional[int] = Field(None, ge=0, le=1)

class ModeloMuebleResponse(ModeloMuebleBase):
    id: int
    activo: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


# --- REPORTES DE CALIDAD ---
class ReporteResponse(BaseModel):
    id: int
    client_uuid: str
    modelo_id: int
    sector_id: int
    descripcion_defecto: str
    cantidad_afectada: str
    foto_path: str
    fecha_captura_local: str
    fecha_sincronizacion: str
    modelo_nombre: Optional[str] = None
    sector_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- CATÁLOGOS LIVIANOS PARA PWA OFFLINE ---
class CatalogosOfflineResponse(BaseModel):
    sectores: List[SectorResponse]
    modelos: List[ModeloMuebleResponse]
    servidor_timestamp_gmt3: str


# --- RESULTADO DE SINCRONIZACIÓN POR LOTES ---
class SyncItemResult(BaseModel):
    client_uuid: str
    status: str  # "guardado", "duplicado", "error"
    detail: Optional[str] = None

class BatchSyncSummary(BaseModel):
    total_recibidos: int
    guardados: int
    duplicados: int
    errores: int
    items: List[SyncItemResult]
