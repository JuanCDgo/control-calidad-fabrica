import hashlib
import hmac
import io
import os
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile, status
from PIL import Image
from app.core.timezone import get_arg_now

# Extensiones y tipos MIME permitidos para las fotos de defectos
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
PIN_MIN_LEN = 4
PIN_MAX_LEN = 12


def normalize_pin(pin: str) -> str:
    """Valida formato básico del PIN de seguridad (sin espacios extremos, 4 a 12 caracteres)."""
    clean = (pin or "").strip()
    if len(clean) < PIN_MIN_LEN or len(clean) > PIN_MAX_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El PIN debe tener entre {PIN_MIN_LEN} y {PIN_MAX_LEN} caracteres."
        )
    if any(ch.isspace() for ch in clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El PIN no puede contener espacios."
        )
    return clean


def hash_pin(pin: str) -> str:
    """Genera un hash PBKDF2-HMAC-SHA256 con salt aleatorio para almacenar el PIN."""
    clean = normalize_pin(pin)
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", clean.encode("utf-8"), salt, 100_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_pin_hash(pin: str, stored_hash: str) -> bool:
    """Compara un PIN ingresado contra su hash almacenado en tiempo constante."""
    if not pin or not stored_hash or "$" not in stored_hash:
        return False
    try:
        salt_hex, digest_hex = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", pin.strip().encode("utf-8"), salt, 100_000)
    return hmac.compare_digest(candidate, expected)

def validate_and_sanitize_image(file: UploadFile, content: bytes) -> str:
    """
    Valida el archivo de imagen en memoria comprobando:
    1. Extensión del nombre de archivo.
    2. Header MIME.
    3. Integridad real de imagen leyendo bytes con Pillow (evita inyecciones/scripts).
    4. Genera un nombre de archivo completamente seguro y no colisionable.
    """
    # 1. Validar extensión informada
    orig_ext = Path(file.filename or "").suffix.lower()
    if orig_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión de archivo no permitida ({orig_ext}). Permitidas: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 2. Validar Content-Type
    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de contenido MIME no válido ({file.content_type})."
        )

    # 3. Validar integridad de imagen real
    try:
        image = Image.open(io.BytesIO(content))
        image.verify()  # Verifica que sea realmente una imagen válida sin decodificarla por completo
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo enviado está corrupto o no es una imagen válida: {str(e)}"
        )

    # 4. Generar nombre único: {timestamp_arg}_{uuid}.ext (impenetrable a Path Traversal)
    timestamp_prefix = get_arg_now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp_prefix}_{uuid.uuid4().hex[:12]}{orig_ext}"
    return safe_name
