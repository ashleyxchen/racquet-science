from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.routers import sessions, videos, sensor_data, pain_notes, fsr


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize storage directories and database on startup."""
    # Ensure storage directories exist
    settings.storage_path.mkdir(parents=True, exist_ok=True)

    # Ensure database directory exists
    from pathlib import Path
    db_path = Path("./storage")
    db_path.mkdir(parents=True, exist_ok=True)

    # Initialize database tables
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API for managing sensor recording sessions and video uploads",
    lifespan=lifespan
)

# CORS configuration for local development
# Allow all origins during development (iOS app uses capacitor://localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sessions.router)
app.include_router(videos.router)
app.include_router(sensor_data.router)
app.include_router(fsr.router)
app.include_router(pain_notes.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
