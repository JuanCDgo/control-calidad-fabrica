import os
from pathlib import Path

# Directorios base
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = Path(os.getenv("CALIDAD_DATA_DIR", str(BASE_DIR / "data")))
UPLOADS_DIR = Path(os.getenv("CALIDAD_UPLOADS_DIR", str(BASE_DIR / "uploads")))
CERTS_DIR = BASE_DIR / "certs"


def resolve_carga_semanal_dir() -> Path:
    """Detecta automáticamente Carga_Semanal cuando la app corre dentro de control-planta-patria."""
    env_dir = os.getenv("CALIDAD_CARGA_DIR")
    if env_dir:
        return Path(env_dir)

    # Estructura unificada: control-planta-patria-v1.2/app_wifi/backend -> ../../Carga_Semanal
    unified_carga = BASE_DIR.parent.parent / "Carga_Semanal"
    if unified_carga.exists():
        return unified_carga

    return BASE_DIR / "carga_semanal"


CARGA_SEMANAL_DIR = resolve_carga_semanal_dir()

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CERTS_DIR.mkdir(parents=True, exist_ok=True)

# Base de datos SQLite
DATABASE_URL = f"sqlite:///{DATA_DIR / 'calidad.db'}"

# Configuración de Servidor
HOST = os.getenv("APP_HOST", "0.0.0.0")
PORT = int(os.getenv("APP_PORT", "8000"))

# Certificados SSL para red local / HTTPS
SSL_CERT_PATH = CERTS_DIR / "cert.pem"
SSL_KEY_PATH = CERTS_DIR / "key.pem"
