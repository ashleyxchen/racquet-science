from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "Sensor Recording API"
    app_version: str = "1.0.0"
    database_url: str = "sqlite+aiosqlite:///./storage/sensor_recordings.db"
    storage_path: Path = Path("./storage/videos")

    class Config:
        env_file = ".env"


settings = Settings()
