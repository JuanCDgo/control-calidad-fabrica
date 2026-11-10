from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# --- SEGURIDAD PIN ---
class PinStatusResponse(BaseModel):
    pin_configurado: bool


class PinVerifyRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=12)


class PinChangeRequest(BaseModel):
    pin_actual: str = Field(..., min_length=4, max_length=12)
    pin_nuevo: str = Field(..., min_length=4, max_length=12)


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


# --- CATEGORÍAS DE MUEBLE ---
class CategoriaMuebleBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre de la categoría de mueble")


class CategoriaMuebleCreate(CategoriaMuebleBase):
    pass


class CategoriaMuebleUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    activo: Optional[int] = Field(None, ge=0, le=1)


class CategoriaMuebleResponse(CategoriaMuebleBase):
    id: int
    es_ejemplo: int = 0
    activo: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


# --- MODELOS DE MUEBLE ---
class ModeloMuebleBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150, description="Nombre del modelo de mueble")
    categoria_id: Optional[int] = Field(None, description="ID de la categoría asociada")
    codigo: Optional[str] = Field(None, max_length=50, description="Código de producto o SKU")
    descripcion: Optional[str] = Field(None, max_length=500)


class ModeloMuebleCreate(ModeloMuebleBase):
    pass


class ModeloMuebleUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    categoria_id: Optional[int] = None
    codigo: Optional[str] = Field(None, max_length=50)
    descripcion: Optional[str] = Field(None, max_length=500)
    activo: Optional[int] = Field(None, ge=0, le=1)


class ModeloMuebleResponse(ModeloMuebleBase):
    id: int
    categoria_nombre: Optional[str] = None
    es_ejemplo: int = 0
    activo: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


# --- REPORTES DE CALIDAD ---
class ReporteResponse(BaseModel):
    id: int
    client_uuid: str
    modelo_id: Optional[int] = None
    modelo_manual: Optional[str] = None
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    sector_id: int
    descripcion_defecto: str
    cantidad_afectada: str
    foto_path: str
    fecha_captura_local: str
    fecha_sincronizacion: str
    modelo_nombre: Optional[str] = None
    modelo_codigo: Optional[str] = None
    sector_nombre: Optional[str] = None
    es_ejemplo: int = 0

    model_config = ConfigDict(from_attributes=True)


# --- CATÁLOGOS LIVIANOS PARA PWA OFFLINE ---
class CatalogosOfflineResponse(BaseModel):
    sectores: List[SectorResponse]
    categorias: List[CategoriaMuebleResponse]
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
