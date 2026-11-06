import sys
import uvicorn
from pathlib import Path

# Agregar directorio backend al path de python
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from generate_certs import ensure_ssl_certificates, get_local_ip
from app.core.config import HOST, PORT

def run():
    cert_file, key_file, local_ip = ensure_ssl_certificates()

    use_ssl = cert_file.exists() and key_file.exists() and ("--no-ssl" not in sys.argv)

    protocol = "https" if use_ssl else "http"
    print("=" * 65)
    print("  CONTROL DE CALIDAD - SERVIDOR CENTRAL FASTAPI")
    print("=" * 65)
    print(f"  Modo:        {'HTTPS (Seguro para Cámara/PWA)' if use_ssl else 'HTTP'}")
    print(f"  Acceso Local (PC):    {protocol}://localhost:{PORT}")
    print(f"  Acceso Red (Planta):  {protocol}://{local_ip}:{PORT}")
    print(f"  Documentación Swagger: {protocol}://{local_ip}:{PORT}/docs")
    if use_ssl:
        print(f"  Certificado:          {cert_file}")
    print("=" * 65)

    ssl_kwargs = {}
    if use_ssl:
        ssl_kwargs = {
            "ssl_certfile": str(cert_file),
            "ssl_keyfile": str(key_file)
        }

    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=False,
        **ssl_kwargs
    )

if __name__ == "__main__":
    run()
