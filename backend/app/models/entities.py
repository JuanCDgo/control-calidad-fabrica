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


class ModeloMueble(Base):
    __tablename__ = "modelos_mueble"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(150), unique=True, nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=True)
    descripcion = Column(Text, nullable=True)
    activo = Column(Integer, default=1, nullable=False)  # 1: Activo, 0: Inactivo
    created_at = Column(String(30), default=get_arg_now_str, nullable=False)
    updated_at = Column(String(30), default=get_arg_now_str, onupdate=get_arg_now_str, nullable=False)

    __table_args__ = (
        CheckConstraint("activo IN (0, 1)", name="check_modelo_activo_boolean"),
    )

    reportes = relationship("ReporteCalidad", back_populates="modelo")


class ReporteCalidad(Base):
    __tablename__ = "reportes_calidad"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    client_uuid = Column(String(64), unique=True, nullable=False, index=True) # UUID generado en PWA
    modelo_id = Column(Integer, ForeignKey("modelos_mueble.id"), nullable=False, index=True)
    sector_id = Column(Integer, ForeignKey("sectores.id"), nullable=False, index=True)
    descripcion_defecto = Column(Text, nullable=False)
    cantidad_afectada = Column(String(100), nullable=False)
    foto_path = Column(String(255), nullable=False) # Ruta relativa /uploads/...
    fecha_captura_local = Column(String(30), nullable=False) # Fecha en GMT-3 registrada en el celular
    fecha_sincronizacion = Column(String(30), default=get_arg_now_str, nullable=False) # Fecha en GMT-3 al recibir

    sector = relationship("Sector", back_populates="reportes")
    modelo = relationship("ModeloMueble", back_populates="reportes")
