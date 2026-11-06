from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOADS_DIR
from app.core.database import SessionLocal
from app.core.init_db import init_db
from app.core.timezone import get_arg_now_str
from app.api.v1 import admin, reportes, catalogos

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización de la base de datos SQLite y seed inicial
    db = SessionLocal()
    try:
        init_db(db)
        print("Base de datos SQLite inicializada y sectores cargados correctamente.")
    finally:
        db.close()
    yield
    print("Cerrando aplicación...")

app = FastAPI(
    title="Control de Calidad - Fábrica de Muebles",
    description="Backend central offline-first para registro de defectos en planta industrial.",
    version="1.0.0",
    lifespan=lifespan
)

# Configuración de CORS amplia para red LAN de la fábrica
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar carpeta de fotos estáticas para visualización en el panel administrativo
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Registrar routers de la API v1
app.include_router(catalogos.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(reportes.router, prefix="/api/v1")

@app.get("/api/health", tags=["Estado"])
def health_check():
    """Chequeo de salud del backend con fecha y hora argentina (GMT-3)."""
    return {
        "status": "online",
        "app": "Control de Calidad - Fábrica de Muebles",
        "hora_argentina_gmt3": get_arg_now_str()
    }
