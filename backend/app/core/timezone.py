from datetime import datetime, timezone, timedelta

# Zona Horaria Argentina (ART / GMT-3)
TZ_ARG = timezone(timedelta(hours=-3))

def get_arg_now() -> datetime:
    """Retorna datetime actual en zona horaria Argentina (GMT-3)."""
    return datetime.now(TZ_ARG)

def get_arg_now_str() -> str:
    """Retorna fecha y hora actual en formato estándar argentino de 24hs: YYYY-MM-DD HH:MM:SS."""
    return get_arg_now().strftime("%Y-%m-%d %H:%M:%S")

def format_arg_datetime(dt: datetime) -> str:
    """Convierte un objeto datetime a string argentino de 24hs."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(TZ_ARG)
    else:
        dt = dt.astimezone(TZ_ARG)
    return dt.strftime("%Y-%m-%d %H:%M:%S")
