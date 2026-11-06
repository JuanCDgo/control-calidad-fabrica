from pathlib import Path
from fastapi import UploadFile
from app.core.config import UPLOADS_DIR
from app.core.timezone import get_arg_now
from app.core.security import validate_and_sanitize_image

def save_uploaded_photo(file: UploadFile, content: bytes) -> str:
    """
    Valida la imagen de forma estricta y la guarda en disco particionada por año y mes.
    Retorna la ruta relativa web normalizada para base de datos.
    """
    safe_filename = validate_and_sanitize_image(file, content)
    
    now = get_arg_now()
    year_str = now.strftime("%Y")
    month_str = now.strftime("%m")
    
    target_dir = UPLOADS_DIR / year_str / month_str
    target_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = target_dir / safe_filename
    with open(file_path, "wb") as f:
        f.write(content)
        
    # Ruta relativa con barras normales para URLs y API
    return f"/uploads/{year_str}/{month_str}/{safe_filename}"
