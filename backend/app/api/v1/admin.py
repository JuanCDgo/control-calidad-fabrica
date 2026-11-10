from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.security import hash_pin, verify_pin_hash
from app.core.timezone import get_arg_now_str
from app.models.entities import (
    Sector,
    CategoriaMueble,
    ModeloMueble,
    ReporteCalidad,
    ConfiguracionSeguridad,
)
from app.schemas.dtos import (
    PinStatusResponse,
    PinVerifyRequest,
    PinChangeRequest,
    SectorCreate,
    SectorUpdate,
    SectorResponse,
    CategoriaMuebleCreate,
    CategoriaMuebleUpdate,
    CategoriaMuebleResponse,
    ModeloMuebleCreate,
    ModeloMuebleUpdate,
    ModeloMuebleResponse,
)

router = APIRouter(prefix="/admin", tags=["Administración Central"])

ADMIN_PIN_KEY = "admin_pin_hash"


def _get_pin_record(db: Session) -> Optional[ConfiguracionSeguridad]:
    return (
        db.query(ConfiguracionSeguridad)
        .filter(ConfiguracionSeguridad.clave == ADMIN_PIN_KEY)
        .first()
    )


def require_admin_pin(
    x_admin_pin: Optional[str] = Header(default=None, alias="X-Admin-Pin"),
    db: Session = Depends(get_db),
) -> None:
    """Exige un PIN maestro válido para crear, editar o borrar categorías y modelos."""
    pin_row = _get_pin_record(db)
    if not pin_row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Primero configurá tu PIN de seguridad en 'Categorías y Muebles'.",
        )
    if not x_admin_pin or not verify_pin_hash(x_admin_pin, pin_row.valor):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN de seguridad incorrecto o bloqueado.",
        )


def _serialize_modelo(modelo: ModeloMueble) -> ModeloMuebleResponse:
    return ModeloMuebleResponse(
        id=modelo.id,
        nombre=modelo.nombre,
        categoria_id=modelo.categoria_id,
        categoria_nombre=modelo.categoria.nombre if modelo.categoria else None,
        codigo=modelo.codigo,
        descripcion=modelo.descripcion,
        es_ejemplo=modelo.es_ejemplo,
        activo=modelo.activo,
        created_at=modelo.created_at,
        updated_at=modelo.updated_at,
    )


# ==========================================
# SEGURIDAD PIN (PROTECCIÓN DE CATEGORÍAS Y MODELOS)
# ==========================================

@router.get("/pin/status", response_model=PinStatusResponse)
def pin_status(db: Session = Depends(get_db)):
    return PinStatusResponse(pin_configurado=_get_pin_record(db) is not None)


@router.post("/pin/setup", response_model=PinStatusResponse)
def pin_setup(datos: PinVerifyRequest, db: Session = Depends(get_db)):
    if _get_pin_record(db) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El PIN ya está configurado. Usá la opción de cambiar PIN.",
        )
    now = get_arg_now_str()
    nuevo = ConfiguracionSeguridad(
        clave=ADMIN_PIN_KEY,
        valor=hash_pin(datos.pin),
        updated_at=now,
    )
    db.add(nuevo)
    db.commit()
    return PinStatusResponse(pin_configurado=True)


@router.post("/pin/verify")
def pin_verify(datos: PinVerifyRequest, db: Session = Depends(get_db)):
    pin_row = _get_pin_record(db)
    if not pin_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Todavía no hay un PIN configurado.",
        )
    if not verify_pin_hash(datos.pin, pin_row.valor):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN incorrecto.",
        )
    return {"valid": True}


@router.post("/pin/change")
def pin_change(datos: PinChangeRequest, db: Session = Depends(get_db)):
    pin_row = _get_pin_record(db)
    if not pin_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Todavía no hay un PIN configurado.",
        )
    if not verify_pin_hash(datos.pin_actual, pin_row.valor):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El PIN actual es incorrecto.",
        )
    pin_row.valor = hash_pin(datos.pin_nuevo)
    pin_row.updated_at = get_arg_now_str()
    db.commit()
    return {"mensaje": "PIN actualizado correctamente."}


# ==========================================
# CRUD SECTORES (LIBRE SIN PIN)
# ==========================================

@router.get("/sectores", response_model=List[SectorResponse])
def listar_sectores(
    solo_activos: bool = Query(False, description="Si es True, devuelve solo los activos"),
    db: Session = Depends(get_db),
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
            detail=f"Ya existe un sector con el nombre '{nombre_limpio}'.",
        )

    now = get_arg_now_str()
    nuevo_sector = Sector(
        nombre=nombre_limpio,
        activo=1,
        created_at=now,
        updated_at=now,
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
            Sector.id != sector_id,
        ).first()
        if duplicado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro sector con el nombre '{nombre_limpio}'.",
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
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sector no encontrado.")

    tiene_reportes = db.query(ReporteCalidad).filter(ReporteCalidad.sector_id == sector_id).first() is not None
    if tiene_reportes:
        sector.activo = 0
        sector.updated_at = get_arg_now_str()
        db.commit()
        return {"mensaje": "Sector desactivado (mantiene historial por reportes asociados)", "id": sector_id, "activo": 0}
    db.delete(sector)
    db.commit()
    return {"mensaje": "Sector eliminado definitivamente (sin historial)", "id": sector_id}


# ==========================================
# CRUD CATEGORÍAS DE MUEBLE (PROTEGIDO CON PIN)
# ==========================================

@router.get("/categorias", response_model=List[CategoriaMuebleResponse])
def listar_categorias(
    solo_activos: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(CategoriaMueble)
    if solo_activos:
        query = query.filter(CategoriaMueble.activo == 1)
    return query.order_by(CategoriaMueble.es_ejemplo.asc(), CategoriaMueble.nombre.asc()).all()


@router.post(
    "/categorias",
    response_model=CategoriaMuebleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_pin)],
)
def crear_categoria(datos: CategoriaMuebleCreate, db: Session = Depends(get_db)):
    nombre_limpio = datos.nombre.strip()
    existente = db.query(CategoriaMueble).filter(CategoriaMueble.nombre.ilike(nombre_limpio)).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una categoría con el nombre '{nombre_limpio}'.",
        )
    now = get_arg_now_str()
    nueva = CategoriaMueble(
        nombre=nombre_limpio,
        es_ejemplo=0,
        activo=1,
        created_at=now,
        updated_at=now,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put(
    "/categorias/{categoria_id}",
    response_model=CategoriaMuebleResponse,
    dependencies=[Depends(require_admin_pin)],
)
def actualizar_categoria(categoria_id: int, datos: CategoriaMuebleUpdate, db: Session = Depends(get_db)):
    cat = db.query(CategoriaMueble).filter(CategoriaMueble.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada.")

    if datos.nombre is not None:
        nombre_limpio = datos.nombre.strip()
        dup = db.query(CategoriaMueble).filter(
            CategoriaMueble.nombre.ilike(nombre_limpio),
            CategoriaMueble.id != categoria_id,
        ).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otra categoría con el nombre '{nombre_limpio}'.",
            )
        cat.nombre = nombre_limpio

    if datos.activo is not None:
        cat.activo = datos.activo

    cat.updated_at = get_arg_now_str()
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categorias/{categoria_id}", dependencies=[Depends(require_admin_pin)])
def eliminar_o_desactivar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    cat = db.query(CategoriaMueble).filter(CategoriaMueble.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada.")

    modelos_cat = db.query(ModeloMueble).filter(ModeloMueble.categoria_id == categoria_id).all()
    if cat.es_ejemplo == 1:
        # Limpiar reportes de ejemplo asociados y modelos de ejemplo
        for m in modelos_cat:
            db.query(ReporteCalidad).filter(
                ReporteCalidad.modelo_id == m.id, ReporteCalidad.es_ejemplo == 1
            ).delete()
            db.delete(m)
        db.delete(cat)
        db.commit()
        return {"mensaje": "Categoría de ejemplo eliminada.", "id": categoria_id}

    if modelos_cat:
        # Verificar si algún modelo tiene reportes reales
        modelo_ids = [m.id for m in modelos_cat]
        tiene_reportes = (
            db.query(ReporteCalidad)
            .filter(ReporteCalidad.modelo_id.in_(modelo_ids))
            .first()
            is not None
        )
        if tiene_reportes:
            cat.activo = 0
            cat.updated_at = get_arg_now_str()
            db.commit()
            return {"mensaje": "Categoría desactivada (mantiene historial de reportes).", "id": categoria_id, "activo": 0}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Esta categoría tiene {len(modelos_cat)} modelo(s) asignado(s). Movélos o eliminálos primero.",
        )

    db.delete(cat)
    db.commit()
    return {"mensaje": "Categoría eliminada definitivamente.", "id": categoria_id}


# ==========================================
# CRUD MODELOS DE MUEBLE (PROTEGIDO CON PIN)
# ==========================================

@router.get("/modelos", response_model=List[ModeloMuebleResponse])
def listar_modelos(
    solo_activos: bool = Query(False, description="Si es True, devuelve solo los activos"),
    categoria_id: Optional[int] = Query(None, description="Filtrar por categoría"),
    db: Session = Depends(get_db),
):
    query = db.query(ModeloMueble).options(joinedload(ModeloMueble.categoria))
    if solo_activos:
        query = query.filter(ModeloMueble.activo == 1)
    if categoria_id is not None:
        query = query.filter(ModeloMueble.categoria_id == categoria_id)
    modelos = query.order_by(ModeloMueble.es_ejemplo.asc(), ModeloMueble.nombre.asc()).all()
    return [_serialize_modelo(m) for m in modelos]


@router.post(
    "/modelos",
    response_model=ModeloMuebleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_pin)],
)
def crear_modelo(datos: ModeloMuebleCreate, db: Session = Depends(get_db)):
    nombre_limpio = datos.nombre.strip()
    existente = db.query(ModeloMueble).filter(ModeloMueble.nombre.ilike(nombre_limpio)).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un modelo con el nombre '{nombre_limpio}'.",
        )

    if datos.categoria_id is not None:
        cat = db.query(CategoriaMueble).filter(CategoriaMueble.id == datos.categoria_id).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La categoría seleccionada no existe.")
        if cat.es_ejemplo == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No cargues modelos reales dentro de la categoría de ejemplo. Creá una categoría real primero.",
            )

    codigo_limpio = datos.codigo.strip() if datos.codigo else None
    if codigo_limpio:
        codigo_dup = db.query(ModeloMueble).filter(ModeloMueble.codigo.ilike(codigo_limpio)).first()
        if codigo_dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un modelo con el código '{codigo_limpio}'.",
            )

    now = get_arg_now_str()
    nuevo_modelo = ModeloMueble(
        nombre=nombre_limpio,
        categoria_id=datos.categoria_id,
        codigo=codigo_limpio,
        descripcion=datos.descripcion.strip() if datos.descripcion else None,
        es_ejemplo=0,
        activo=1,
        created_at=now,
        updated_at=now,
    )
    db.add(nuevo_modelo)
    db.commit()
    db.refresh(nuevo_modelo)
    modelo_full = (
        db.query(ModeloMueble)
        .options(joinedload(ModeloMueble.categoria))
        .filter(ModeloMueble.id == nuevo_modelo.id)
        .first()
    )
    return _serialize_modelo(modelo_full)


@router.put(
    "/modelos/{modelo_id}",
    response_model=ModeloMuebleResponse,
    dependencies=[Depends(require_admin_pin)],
)
def actualizar_modelo(modelo_id: int, datos: ModeloMuebleUpdate, db: Session = Depends(get_db)):
    modelo = db.query(ModeloMueble).filter(ModeloMueble.id == modelo_id).first()
    if not modelo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado.")

    if datos.nombre is not None:
        nombre_limpio = datos.nombre.strip()
        duplicado = db.query(ModeloMueble).filter(
            ModeloMueble.nombre.ilike(nombre_limpio),
            ModeloMueble.id != modelo_id,
        ).first()
        if duplicado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro modelo con el nombre '{nombre_limpio}'.",
            )
        modelo.nombre = nombre_limpio

    if "categoria_id" in datos.model_fields_set:
        if datos.categoria_id is not None:
            cat = db.query(CategoriaMueble).filter(CategoriaMueble.id == datos.categoria_id).first()
            if not cat:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La categoría seleccionada no existe.")
            if cat.es_ejemplo == 1 and modelo.es_ejemplo == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No asignes un modelo real a la categoría de ejemplo.",
                )
        modelo.categoria_id = datos.categoria_id

    if datos.codigo is not None:
        codigo_limpio = datos.codigo.strip() if datos.codigo else None
        if codigo_limpio:
            codigo_dup = db.query(ModeloMueble).filter(
                ModeloMueble.codigo.ilike(codigo_limpio),
                ModeloMueble.id != modelo_id,
            ).first()
            if codigo_dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe otro modelo con el código '{codigo_limpio}'.",
                )
        modelo.codigo = codigo_limpio

    if datos.descripcion is not None:
        modelo.descripcion = datos.descripcion.strip() if datos.descripcion else None

    if datos.activo is not None:
        modelo.activo = datos.activo

    modelo.updated_at = get_arg_now_str()
    db.commit()
    modelo_full = (
        db.query(ModeloMueble)
        .options(joinedload(ModeloMueble.categoria))
        .filter(ModeloMueble.id == modelo.id)
        .first()
    )
    return _serialize_modelo(modelo_full)


@router.delete("/modelos/{modelo_id}", dependencies=[Depends(require_admin_pin)])
def eliminar_o_desactivar_modelo(modelo_id: int, db: Session = Depends(get_db)):
    modelo = db.query(ModeloMueble).filter(ModeloMueble.id == modelo_id).first()
    if not modelo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado.")

    if modelo.es_ejemplo == 1:
        db.query(ReporteCalidad).filter(
            ReporteCalidad.modelo_id == modelo_id, ReporteCalidad.es_ejemplo == 1
        ).delete()
        db.delete(modelo)
        db.commit()
        return {"mensaje": "Modelo de ejemplo eliminado.", "id": modelo_id}

    tiene_reportes = db.query(ReporteCalidad).filter(ReporteCalidad.modelo_id == modelo_id).first() is not None
    if tiene_reportes:
        modelo.activo = 0
        modelo.updated_at = get_arg_now_str()
        db.commit()
        return {"mensaje": "Modelo desactivado (mantiene historial por reportes asociados)", "id": modelo_id, "activo": 0}
    db.delete(modelo)
    db.commit()
    return {"mensaje": "Modelo eliminado definitivamente (sin historial)", "id": modelo_id}
