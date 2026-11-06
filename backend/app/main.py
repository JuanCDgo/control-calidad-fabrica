from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOADS_DIR, BASE_DIR, PORT, SSL_CERT_PATH, SSL_KEY_PATH
from app.core.database import SessionLocal
from app.core.init_db import init_db
from app.core.timezone import get_arg_now_str
from app.api.v1 import admin, reportes, catalogos
from generate_certs import get_local_ip
from fastapi.responses import FileResponse

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

@app.get("/api/server-info", tags=["Estado"])
def server_info():
    """Retorna la IP LAN dinámica actual y la URL completa del servidor para generación de QR."""
    local_ip = get_local_ip()
    use_ssl = SSL_CERT_PATH.exists() and SSL_KEY_PATH.exists()
    protocol = "https" if use_ssl else "http"
    return {
        "local_ip": local_ip,
        "port": PORT,
        "protocol": protocol,
        "server_url": f"{protocol}://{local_ip}:{PORT}",
        "hora_gmt3": get_arg_now_str()
    }

# Servir PWA React compilada si existe la carpeta frontend/dist
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        target = FRONTEND_DIST / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
