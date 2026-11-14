from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR, BASE_DIR, PORT, SSL_CERT_PATH, SSL_KEY_PATH, CERTS_DIR, CARGA_SEMANAL_DIR
from app.core.database import SessionLocal, get_db
from app.core.init_db import init_db
from app.core.timezone import get_arg_now_str
from app.models.entities import ReporteCalidad
from app.api.v1 import admin, reportes, catalogos
from generate_certs import get_local_ip


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        init_db(db)
        print("Base de datos SQLite inicializada y catálogos v1.2 cargados correctamente.")
    finally:
        db.close()
    yield
    print("Cerrando aplicación...")


app = FastAPI(
    title="Control de Planta Patria v1.2 - Calidad & Desvíos",
    description="Backend central offline-first unificado con planillas semanales de planta.",
    version="1.2.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(catalogos.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(reportes.router, prefix="/api/v1")


@app.get("/f/{reporte_id}", tags=["Fotos"])
def ver_foto_corta(reporte_id: int, db: Session = Depends(get_db)):
    """Link corto para abrir directamente la foto de un reporte por ID."""
    rep = db.query(ReporteCalidad).filter(ReporteCalidad.id == reporte_id).first()
    if not rep or not rep.foto_path:
        raise HTTPException(status_code=404, detail="Este reporte no tiene foto adjunta.")
    rel = rep.foto_path.lstrip("/").replace("uploads/", "", 1)
    file_path = UPLOADS_DIR / rel
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de foto no encontrado en disco.")
    return FileResponse(str(file_path))


@app.get("/api/health", tags=["Estado"])
def health_check():
    """Chequeo de salud del backend con fecha y hora argentina (GMT-3)."""
    return {
        "status": "online",
        "app": "Control de Planta Patria v1.2",
        "hora_argentina_gmt3": get_arg_now_str()
    }


@app.get("/api/server-info", tags=["Estado"])
def server_info():
    """Retorna la IP LAN dinámica actual y la ruta de planillas semanales."""
    local_ip = get_local_ip()
    use_ssl = SSL_CERT_PATH.exists() and SSL_KEY_PATH.exists()
    protocol = "https" if use_ssl else "http"
    return {
        "local_ip": local_ip,
        "port": PORT,
        "protocol": protocol,
        "server_url": f"{protocol}://{local_ip}:{PORT}",
        "carga_semanal_dir": str(CARGA_SEMANAL_DIR),
        "hora_gmt3": get_arg_now_str()
    }


@app.get("/api/ca-cert", tags=["Estado"])
def download_root_ca():
    """Descarga el certificado Root CA local para instalar en celulares Android/iOS y PCs."""
    ca_path = CERTS_DIR / "rootCA.crt"
    if not ca_path.exists():
        raise HTTPException(status_code=404, detail="Certificado Root CA no encontrado en el servidor.")
    return FileResponse(
        path=str(ca_path),
        media_type="application/x-x509-ca-cert",
        filename="FabricaCalidadRootCA.crt"
    )


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
