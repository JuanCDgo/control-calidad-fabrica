from sqlalchemy.orm import Session
from app.core.database import engine, Base
from app.core.timezone import get_arg_now_str
from app.models.entities import Sector, ModeloMueble

SECTORES_INICIALES = [
    "Maquinado",
    "Armado",
    "Cabinas de Fondo",
    "Cabinas de Terminación",
    "Embalaje",
    "Living y Colchones",
    "Red"
]

MODELOS_INICIALES = [
    {"nombre": "Mesa Comedor Nórdica", "codigo": "MCN-01", "descripcion": "Mesa fija madera maciza y paraíso"},
    {"nombre": "Silla Paraíso Tapizada", "codigo": "SPT-02", "descripcion": "Estructura paraíso con tapizado lino"},
    {"nombre": "Rack TV Escandinavo", "codigo": "RTV-03", "descripcion": "Mueble TV 1.60m con puertas laqueadas"}
]

def init_db(db: Session) -> None:
    """Crea las tablas en SQLite y puebla los datos iniciales obligatorios si está vacía."""
    Base.metadata.create_all(bind=engine)

    # 1. Poblar sectores requeridos
    sectores_count = db.query(Sector).count()
    if sectores_count == 0:
        now_str = get_arg_now_str()
        for nombre in SECTORES_INICIALES:
            sector = Sector(
                nombre=nombre,
                activo=1,
                created_at=now_str,
                updated_at=now_str
            )
            db.add(sector)
        db.commit()

    # 2. Poblar modelos base de prueba si no hay ninguno
    modelos_count = db.query(ModeloMueble).count()
    if modelos_count == 0:
        now_str = get_arg_now_str()
        for mod in MODELOS_INICIALES:
            modelo = ModeloMueble(
                nombre=mod["nombre"],
                codigo=mod["codigo"],
                descripcion=mod["descripcion"],
                activo=1,
                created_at=now_str,
                updated_at=now_str
            )
            db.add(modelo)
        db.commit()
