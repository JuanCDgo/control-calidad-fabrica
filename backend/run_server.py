import sys
import uvicorn
from pathlib import Path

# Agregar directorio backend al path de python
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from generate_certs import ensure_ssl_certificates, get_local_ip
from app.core.config import HOST, PORT

def print_terminal_qr(url: str):
    """Imprime un código QR escaneable en la consola del servidor."""
    try:
        import qrcode
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.make(fit=True)
        print("  ESCANEA ESTE QR CON EL CELULAR (mismo Wi-Fi):")
        print()
        qr.print_ascii(invert=True)
        print()
    except Exception:
        pass


def run():
    cert_file, key_file, local_ip = ensure_ssl_certificates()

    use_ssl = cert_file.exists() and key_file.exists() and ("--no-ssl" not in sys.argv)

    protocol = "https" if use_ssl else "http"
    lan_url = f"{protocol}://{local_ip}:{PORT}"
    print("=" * 65)
    print("  CONTROL DE PLANTA PATRIA v1.2 - SERVIDOR CENTRAL FASTAPI")
    print("=" * 65)
    print(f"  Modo:        {'HTTPS (Seguro para Cámara/PWA)' if use_ssl else 'HTTP'}")
    print(f"  Acceso Local (PC):    {protocol}://localhost:{PORT}")
    print(f"  Acceso Red (Planta):  {lan_url}")
    print(f"  Documentación Swagger: {lan_url}/docs")
    if use_ssl:
        print(f"  Certificado:          {cert_file}")
    print("=" * 65)
    print_terminal_qr(lan_url)
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
