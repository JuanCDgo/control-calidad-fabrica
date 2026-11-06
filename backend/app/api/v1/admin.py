from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.timezone import get_arg_now_str
from app.models.entities import Sector, ModeloMueble, ReporteCalidad
from app.schemas.dtos import (
    SectorCreate, SectorUpdate, SectorResponse,
    ModeloMuebleCreate, ModeloMuebleUpdate, ModeloMuebleResponse
)

router = APIRouter(prefix="/admin", tags=["Administración Central"])

# ==========================================
# CRUD SECTORES
# ==========================================

@router.get("/sectores", response_model=List[SectorResponse])
def listar_sectores(
    solo_activos: bool = Query(False, description="Si es True, devuelve solo los activos"),
    db: Session = Depends(get_db)
):
    query = db.query(Sector)
    if solo_activos:
        query = query.filter(Sector.activo == 1)
    return query.order_by(Sector.nombre.asc()).all()


@router.post("/sectores", response_model=SectorResponse, status_code=status.HTTP_201_CREATED)
def crear_sector(datos: SectorCreate, db: Session = Depends(get_db)):
    nombre_limpio = datos.nombre.strip()
    existente = db.query(Sector).filter(Sector.nombre.ilike(nombre_limpio)).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un sector con el nombre '{nombre_limpio}'."
        )

    now = get_arg_now_str()
    nuevo_sector = Sector(
        nombre=nombre_limpio,
        activo=1,
        created_at=now,
        updated_at=now
    )
    db.add(nuevo_sector)
    db.commit()
    db.refresh(nuevo_sector)
    return nuevo_sector


@router.put("/sectores/{sector_id}", response_model=SectorResponse)
def actualizar_sector(sector_id: int, datos: SectorUpdate, db: Session = Depends(get_db)):
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sector no encontrado.")

    if datos.nombre is not None:
        nombre_limpio = datos.nombre.strip()
        duplicado = db.query(Sector).filter(
            Sector.nombre.ilike(nombre_limpio),
            Sector.id != sector_id
        ).first()
        if duplicado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro sector con el nombre '{nombre_limpio}'."
            )
        sector.nombre = nombre_limpio

    if datos.activo is not None:
        sector.activo = datos.activo

    sector.updated_at = get_arg_now_str()
    db.commit()
    db.refresh(sector)
    return sector


@router.delete("/sectores/{sector_id}")
def eliminar_o_desactivar_sector(sector_id: int, db: Session = Depends(get_db)):
    """
    Desactiva el sector (borrado lógico) si tiene historial de reportes para no romper relaciones.
    Si no tiene reportes asociados, lo elimina de la BD.
    """
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sector no encontrado.")

    tiene_reportes = db.query(ReporteCalidad).filter(ReporteCalidad.sector_id == sector_id).first() is not None

    if tiene_reportes:
        sector.activo = 0
        sector.updated_at = get_arg_now_str()
        db.commit()
        return {"mensaje": "Sector desactivado (mantiene historial por reportes asociados)", "id": sector_id, "activo": 0}
    else:
        db.delete(sector)
        db.commit()
        return {"mensaje": "Sector eliminado definitivamente (sin historial)", "id": sector_id}


# ==========================================
# CRUD MODELOS DE MUEBLE
# ==========================================

@router.get("/modelos", response_model=List[ModeloMuebleResponse])
def listar_modelos(
    solo_activos: bool = Query(False, description="Si es True, devuelve solo los activos"),
    db: Session = Depends(get_db)
):
    query = db.query(ModeloMueble)
    if solo_activos:
        query = query.filter(ModeloMueble.activo == 1)
    return query.order_by(ModeloMueble.nombre.asc()).all()


@router.post("/modelos", response_model=ModeloMuebleResponse, status_code=status.HTTP_201_CREATED)
def crear_modelo(datos: ModeloMuebleCreate, db: Session = Depends(get_db)):
    nombre_limpio = datos.nombre.strip()
    existente = db.query(ModeloMueble).filter(ModeloMueble.nombre.ilike(nombre_limpio)).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un modelo con el nombre '{nombre_limpio}'."
        )

    codigo_limpio = datos.codigo.strip() if datos.codigo else None
    if codigo_limpio:
        codigo_dup = db.query(ModeloMueble).filter(ModeloMueble.codigo.ilike(codigo_limpio)).first()
        if codigo_dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un modelo con el código '{codigo_limpio}'."
            )

    now = get_arg_now_str()
    nuevo_modelo = ModeloMueble(
        nombre=nombre_limpio,
        codigo=codigo_limpio,
        descripcion=datos.descripcion.strip() if datos.descripcion else None,
        activo=1,
        created_at=now,
        updated_at=now
    )
    db.add(nuevo_modelo)
    db.commit()
    db.refresh(nuevo_modelo)
    return nuevo_modelo


@router.put("/modelos/{modelo_id}", response_model=ModeloMuebleResponse)
def actualizar_modelo(modelo_id: int, datos: ModeloMuebleUpdate, db: Session = Depends(get_db)):
    modelo = db.query(ModeloMueble).filter(ModeloMueble.id == modelo_id).first()
    if not modelo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado.")

    if datos.nombre is not None:
        nombre_limpio = datos.nombre.strip()
        duplicado = db.query(ModeloMueble).filter(
            ModeloMueble.nombre.ilike(nombre_limpio),
            ModeloMueble.id != modelo_id
        ).first()
        if duplicado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro modelo con el nombre '{nombre_limpio}'."
            )
        modelo.nombre = nombre_limpio

    if datos.codigo is not None:
        codigo_limpio = datos.codigo.strip() if datos.codigo else None
        if codigo_limpio:
            codigo_dup = db.query(ModeloMueble).filter(
                ModeloMueble.codigo.ilike(codigo_limpio),
                ModeloMueble.id != modelo_id
            ).first()
            if codigo_dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe otro modelo con el código '{codigo_limpio}'."
                )
        modelo.codigo = codigo_limpio

    if datos.descripcion is not None:
        modelo.descripcion = datos.descripcion.strip() if datos.descripcion else None

    if datos.activo is not None:
        modelo.activo = datos.activo

    modelo.updated_at = get_arg_now_str()
    db.commit()
    db.refresh(modelo)
    return modelo


@router.delete("/modelos/{modelo_id}")
def eliminar_o_desactivar_modelo(modelo_id: int, db: Session = Depends(get_db)):
    """
    Desactiva el modelo (borrado lógico) si tiene historial de reportes.
    Si no tiene reportes asociados, lo elimina de la BD.
    """
    modelo = db.query(ModeloMueble).filter(ModeloMueble.id == modelo_id).first()
    if not modelo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado.")

    tiene_reportes = db.query(ReporteCalidad).filter(ReporteCalidad.modelo_id == modelo_id).first() is not None

    if tiene_reportes:
        modelo.activo = 0
        modelo.updated_at = get_arg_now_str()
        db.commit()
        return {"mensaje": "Modelo desactivado (mantiene historial por reportes asociados)", "id": modelo_id, "activo": 0}
    else:
        db.delete(modelo)
        db.commit()
        return {"mensaje": "Modelo eliminado definitivamente (sin historial)", "id": modelo_id}
