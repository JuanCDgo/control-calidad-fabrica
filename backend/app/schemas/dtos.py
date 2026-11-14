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


# --- ENCARGADOS ---
class EncargadoBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre del encargado o responsable")
    sector_default: Optional[str] = Field(None, max_length=100, description="Sector principal asociado")
    archivo_excel: Optional[str] = Field(None, max_length=180, description="Nombre del archivo Excel en Carga_Semanal")


class EncargadoCreate(EncargadoBase):
    pass


class EncargadoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    sector_default: Optional[str] = Field(None, max_length=100)
    archivo_excel: Optional[str] = Field(None, max_length=180)
    activo: Optional[int] = Field(None, ge=0, le=1)


class EncargadoResponse(EncargadoBase):
    id: int
    activo: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


# --- TIPOS DE PROBLEMA (CATEGORÍAS PARETO) ---
class TipoProblemaBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120, description="Tipo o categoría del problema")


class TipoProblemaCreate(TipoProblemaBase):
    pass


class TipoProblemaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=120)
    activo: Optional[int] = Field(None, ge=0, le=1)


class TipoProblemaResponse(TipoProblemaBase):
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


# --- REPORTES DE PROBLEMAS / CALIDAD ---
class ReporteUpdate(BaseModel):
    encargado_id: Optional[int] = None
    tipo_problema_id: Optional[int] = None
    impacto: Optional[str] = Field(None, max_length=30)
    modelo_id: Optional[int] = None
    modelo_manual: Optional[str] = Field(None, max_length=150)
    detalle_pieza: Optional[str] = Field(None, max_length=200)
    sector_id: Optional[int] = None
    descripcion_defecto: Optional[str] = None
    cantidad_afectada: Optional[str] = Field(None, max_length=100)
    accion_inmediata: Optional[str] = None
    estado: Optional[str] = Field(None, max_length=30)


class ReporteResponse(BaseModel):
    id: int
    client_uuid: str
    encargado_id: Optional[int] = None
    encargado_nombre: Optional[str] = None
    encargado_archivo: Optional[str] = None
    tipo_problema_id: Optional[int] = None
    tipo_problema_nombre: Optional[str] = None
    impacto: str = "DEFECTO"
    modelo_id: Optional[int] = None
    modelo_manual: Optional[str] = None
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    detalle_pieza: Optional[str] = None
    sector_id: int
    descripcion_defecto: str
    cantidad_afectada: str
    accion_inmediata: Optional[str] = None
    estado: str = "Abierto"
    foto_path: Optional[str] = None
    foto_link_corto: Optional[str] = None
    fecha_captura_local: str
    fecha_sincronizacion: str
    modelo_nombre: Optional[str] = None
    modelo_codigo: Optional[str] = None
    sector_nombre: Optional[str] = None
    es_ejemplo: int = 0
    exportado_excel: int = 0
    exportado_archivo: Optional[str] = None
    exportado_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- EXPORTACIÓN A PLANILLAS DE ENCARGADOS ---
class ExportarPlanillasRequest(BaseModel):
    reporte_ids: Optional[List[int]] = None


class ExportarPlanillasResponse(BaseModel):
    exportados: int
    omitidos: int
    archivos_actualizados: List[str]
    errores: List[str]
    carga_dir: str


# --- CATÁLOGOS LIVIANOS PARA PWA OFFLINE ---
class CatalogosOfflineResponse(BaseModel):
    sectores: List[SectorResponse]
    encargados: List[EncargadoResponse]
    tipos_problema: List[TipoProblemaResponse]
    impactos: List[str]
    estados: List[str]
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
