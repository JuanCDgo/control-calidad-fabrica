from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import DATABASE_URL

# SQLite Engine con check_same_thread=False para compatibilidad con FastAPI multithread
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Configuración crítica de SQLite para alta concurrencia y tolerancia a fallos
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    # Modo Write-Ahead Logging para permitir lecturas y escrituras concurrentes
    cursor.execute("PRAGMA journal_mode=WAL;")
    # Integridad referencial de claves foráneas
    cursor.execute("PRAGMA foreign_keys=ON;")
    # Timeout de 5000ms para evitar 'database is locked' ante ráfagas de sync
    cursor.execute("PRAGMA busy_timeout=5000;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Generador de sesión de base de datos por petición."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
