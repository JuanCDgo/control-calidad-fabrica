import os
import socket
import subprocess
import ipaddress
from datetime import datetime, timedelta, timezone
from pathlib import Path

CERTS_DIR = Path(__file__).resolve().parent / "certs"
CERTS_DIR.mkdir(parents=True, exist_ok=True)

CERT_FILE = CERTS_DIR / "cert.pem"
KEY_FILE = CERTS_DIR / "key.pem"
CA_CERT_FILE = CERTS_DIR / "rootCA.crt"
CA_KEY_FILE = CERTS_DIR / "rootCA.key"
LAST_IP_FILE = CERTS_DIR / "last_ip.txt"

def get_local_ip() -> str:
    """Detecta la IP local de la máquina en la red LAN (WiFi o Ethernet)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No necesita ser alcanzable realmente
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def try_generate_with_mkcert(local_ip: str) -> bool:
    """Intenta generar los certificados usando el comando mkcert si está en el sistema."""
    try:
        subprocess.run(["mkcert", "-version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("mkcert detectado. Generando certificados con mkcert...")
        cmd = [
            "mkcert",
            "-cert-file", str(CERT_FILE),
            "-key-file", str(KEY_FILE),
            "localhost",
            "127.0.0.1",
            local_ip
        ]
        subprocess.run(cmd, check=True)
        print(f"Certificados generados con mkcert en {CERTS_DIR}")
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        return False

def generate_local_ca_and_cert_python(local_ip: str):
    """
    Genera una Autoridad Certificadora Local (Root CA) y un Certificado SSL de Servidor
    usando la librería cryptography de Python.
    Incluye localhost, 127.0.0.1 y la IP LAN del equipo en los SAN (Subject Alternative Names).
    """
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    print(f"Generando Autoridad Certificadora (CA) y Certificado SSL local para IP: {local_ip}...")

    # 1. Clave y Certificado de la CA Raíz (reutilizar si ya existen para no invalidar instalaciones en teléfonos)
    ca_exists = CA_CERT_FILE.exists() and CA_KEY_FILE.exists()
    if ca_exists:
        try:
            with open(CA_KEY_FILE, "rb") as f:
                ca_key = serialization.load_pem_private_key(f.read(), password=None)
            with open(CA_CERT_FILE, "rb") as f:
                ca_cert = x509.load_pem_x509_certificate(f.read())
            ca_name = ca_cert.subject
            print("Reutilizando Root CA existente...")
        except Exception:
            ca_exists = False

    now = datetime.now(timezone.utc)

    if not ca_exists:
        ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        ca_name = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "Fabrica Calidad Local Root CA"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Control de Calidad Fabrica"),
        ])
        ca_cert = (
            x509.CertificateBuilder()
            .subject_name(ca_name)
            .issuer_name(ca_name)
            .public_key(ca_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(days=1))
            .not_valid_after(now + timedelta(days=3650)) # 10 años
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .sign(ca_key, hashes.SHA256())
        )
        with open(CA_CERT_FILE, "wb") as f:
            f.write(ca_cert.public_bytes(serialization.Encoding.PEM))
        with open(CA_KEY_FILE, "wb") as f:
            f.write(ca_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))

    # 2. Clave y Certificado del Servidor
    server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    server_name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Servidor Calidad Central"),
    ])

    san_list = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
    ]
    try:
        san_list.append(x509.IPAddress(ipaddress.IPv4Address(local_ip)))
    except ValueError:
        san_list.append(x509.DNSName(local_ip))

    server_cert = (
        x509.CertificateBuilder()
        .subject_name(server_name)
        .issuer_name(ca_name)
        .public_key(server_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=1825)) # 5 años
        .add_extension(x509.SubjectAlternativeName(san_list), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(ca_key, hashes.SHA256())
    )

    # 3. Guardar archivos de servidor (y CA si es nueva)
    if not ca_exists:
        with open(CA_CERT_FILE, "wb") as f:
            f.write(ca_cert.public_bytes(serialization.Encoding.PEM))
        with open(CA_KEY_FILE, "wb") as f:
            f.write(ca_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))

    with open(CERT_FILE, "wb") as f:
        f.write(server_cert.public_bytes(serialization.Encoding.PEM))
    with open(KEY_FILE, "wb") as f:
        f.write(server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))

    print(f"Certificados SSL actualizados con éxito:")
    print(f" - IP Asignada: {local_ip}")
    print(f" - Certificado Servidor: {CERT_FILE}")
    print(f" - Clave Privada Servidor: {KEY_FILE}")
    print(f" - Root CA instalable en celulares: {CA_CERT_FILE}")

def should_regenerate_certs(current_ip: str) -> bool:
    """Comprueba si los certificados no existen o si la IP de la red cambió."""
    if not (CERT_FILE.exists() and KEY_FILE.exists()):
        return True
    if not LAST_IP_FILE.exists():
        return True
    try:
        last_saved_ip = LAST_IP_FILE.read_text(encoding="utf-8").strip()
        if last_saved_ip != current_ip:
            print(f"\n[AUTO-SSL] Cambio de red detectado: IP previa '{last_saved_ip}' != IP actual '{current_ip}'")
            return True
    except Exception:
        return True
    return False

def ensure_ssl_certificates(force_ip: str | None = None) -> tuple[Path, Path, str]:
    """
    Detecta la IP actual y garantiza certificados válidos.
    Si la IP cambió respecto al último inicio, regenera el certificado automáticamente.
    """
    local_ip = force_ip or get_local_ip()
    if should_regenerate_certs(local_ip):
        print(f"[AUTO-SSL] Regenerando certificados para la nueva IP: {local_ip}...")
        success = try_generate_with_mkcert(local_ip)
        if not success:
            generate_local_ca_and_cert_python(local_ip)
        try:
            LAST_IP_FILE.write_text(local_ip, encoding="utf-8")
        except Exception as e:
            print(f"Aviso al actualizar last_ip.txt: {e}")
    else:
        print(f"[AUTO-SSL] Certificados vigentes y alineados con la IP actual: {local_ip}")

    return CERT_FILE, KEY_FILE, local_ip

if __name__ == "__main__":
    ip = get_local_ip()
    print(f"IP LAN Detectada: {ip}")
    ensure_ssl_certificates()
