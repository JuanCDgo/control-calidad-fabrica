import os
from pathlib import Path

# Directorios base
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads"
CERTS_DIR = BASE_DIR / "certs"

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
