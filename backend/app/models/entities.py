from sqlalchemy import Column, Integer, String, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.timezone import get_arg_now_str


class Sector(Base):
    __tablename__ = "sectores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), unique=True, nullable=False, index=True)
    activo = Column(Integer, default=1, nullable=False)  # 1: Activo, 0: Inactivo
    created_at = Column(String(30), default=get_arg_now_str, nullable=False)
    updated_at = Column(String(30), default=get_arg_now_str, onupdate=get_arg_now_str, nullable=False)

    __table_args__ = (
        CheckConstraint("activo IN (0, 1)", name="check_sector_activo_boolean"),
    )

    reportes = relationship("ReporteCalidad", back_populates="sector")


class Encargado(Base):
    __tablename__ = "encargados"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), unique=True, nullable=False, index=True)
    sector_default = Column(String(100), nullable=True)
    archivo_excel = Column(String(180), nullable=True)
    activo = Column(Integer, default=1, nullable=False)
    created_at = Column(String(30), default=get_arg_now_str, nullable=False)
    updated_at = Column(String(30), default=get_arg_now_str, onupdate=get_arg_now_str, nullable=False)

    __table_args__ = (
        CheckConstraint("activo IN (0, 1)", name="check_encargado_activo_boolean"),
    )

    reportes = relationship("ReporteCalidad", back_populates="encargado")


class TipoProblema(Base):
    __tablename__ = "tipos_problema"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(120), unique=True, nullable=False, index=True)
    activo = Column(Integer, default=1, nullable=False)
    created_at = Column(String(30), default=get_arg_now_str, nullable=False)
    updated_at = Column(String(30), default=get_arg_now_str, onupdate=get_arg_now_str, nullable=False)

    __table_args__ = (
        CheckConstraint("activo IN (0, 1)", name="check_tipo_problema_activo_boolean"),
    )

    reportes = relationship("ReporteCalidad", back_populates="tipo_problema")


class CategoriaMueble(Base):
    __tablename__ = "categorias_mueble"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), unique=True, nullable=False, index=True)
    es_ejemplo = Column(Integer, default=0, nullable=False)  # 1: Muestra excluida de métricas y operarios
    activo = Column(Integer, default=1, nullable=False)
    created_at = Column(String(30), default=get_arg_now_str, nullable=False)
    updated_at = Column(String(30), default=get_arg_now_str, onupdate=get_arg_now_str, nullable=False)

    __table_args__ = (
        CheckConstraint("activo IN (0, 1)", name="check_categoria_activo_boolean"),
        CheckConstraint("es_ejemplo IN (0, 1)", name="check_categoria_ejemplo_boolean"),
    )

    modelos = relationship("ModeloMueble", back_populates="categoria")


class ModeloMueble(Base):
    __tablename__ = "modelos_mueble"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    categoria_id = Column(Integer, ForeignKey("categorias_mueble.id"), nullable=True, index=True)
    nombre = Column(String(150), unique=True, nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=True)
    descripcion = Column(Text, nullable=True)
    es_ejemplo = Column(Integer, default=0, nullable=False)  # 1: Muestra excluida de métricas y operarios
    activo = Column(Integer, default=1, nullable=False)
    created_at = Column(String(30), default=get_arg_now_str, nullable=False)
    updated_at = Column(String(30), default=get_arg_now_str, onupdate=get_arg_now_str, nullable=False)

    __table_args__ = (
        CheckConstraint("activo IN (0, 1)", name="check_modelo_activo_boolean"),
        CheckConstraint("es_ejemplo IN (0, 1)", name="check_modelo_ejemplo_boolean"),
    )

    categoria = relationship("CategoriaMueble", back_populates="modelos")
    reportes = relationship("ReporteCalidad", back_populates="modelo")


class ReporteCalidad(Base):
    __tablename__ = "reportes_calidad"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    client_uuid = Column(String(64), unique=True, nullable=False, index=True)  # UUID generado en PWA
    encargado_id = Column(Integer, ForeignKey("encargados.id"), nullable=True, index=True)
    tipo_problema_id = Column(Integer, ForeignKey("tipos_problema.id"), nullable=True, index=True)
    impacto = Column(String(30), default="DEFECTO", nullable=False)  # FALTA | SOBRA | DEFECTO | OTRO
    modelo_id = Column(Integer, ForeignKey("modelos_mueble.id"), nullable=True, index=True)
    modelo_manual = Column(String(150), nullable=True)  # Para "Otro / Prototipo / General"
    detalle_pieza = Column(String(200), nullable=True)
    sector_id = Column(Integer, ForeignKey("sectores.id"), nullable=False, index=True)
    descripcion_defecto = Column(Text, nullable=False)
    cantidad_afectada = Column(String(100), nullable=False)
    accion_inmediata = Column(Text, nullable=True)
    estado = Column(String(30), default="Abierto", nullable=False)  # Abierto | En Proceso | Resuelto
    foto_path = Column(String(255), nullable=True)  # Opcional: ruta relativa /uploads/...
    fecha_captura_local = Column(String(30), nullable=False)  # Fecha en GMT-3 registrada en el celular
    fecha_sincronizacion = Column(String(30), default=get_arg_now_str, nullable=False)
    es_ejemplo = Column(Integer, default=0, nullable=False)  # 1: Reporte de ejemplo excluido de datos reales
    exportado_excel = Column(Integer, default=0, nullable=False)  # 1: Ya volcado a planilla de encargado
    exportado_archivo = Column(String(180), nullable=True)
    exportado_at = Column(String(30), nullable=True)

    __table_args__ = (
        CheckConstraint("es_ejemplo IN (0, 1)", name="check_reporte_ejemplo_boolean"),
        CheckConstraint("exportado_excel IN (0, 1)", name="check_reporte_exportado_boolean"),
    )

    sector = relationship("Sector", back_populates="reportes")
    modelo = relationship("ModeloMueble", back_populates="reportes")
    encargado = relationship("Encargado", back_populates="reportes")
    tipo_problema = relationship("TipoProblema", back_populates="reportes")


class ConfiguracionSeguridad(Base):
    __tablename__ = "configuracion_seguridad"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    clave = Column(String(60), unique=True, nullable=False, index=True)
    valor = Column(String(255), nullable=False)
    updated_at = Column(String(30), default=get_arg_now_str, onupdate=get_arg_now_str, nullable=False)
