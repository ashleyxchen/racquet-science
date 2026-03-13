# Sensor Recording Backend

FastAPI backend for managing sensor recording sessions and video uploads.

## Features

- Session management (create, read, update, delete)
- Video upload and streaming
- Bulk sensor data upload
- SQLite for development (easily switchable to PostgreSQL)
- Async/await throughout
- Auto-generated API documentation

## Setup

### 1. Create virtual environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at http://localhost:8000

## API Documentation

Once the server is running, visit:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Sessions

- `POST /api/sessions` - Create a new session
- `GET /api/sessions` - List all sessions (with pagination)
- `GET /api/sessions/{id}` - Get session details
- `PATCH /api/sessions/{id}` - Update session
- `DELETE /api/sessions/{id}` - Delete session

### Videos

- `POST /api/sessions/{id}/video` - Upload video
- `GET /api/sessions/{id}/video` - Download/stream video
- `DELETE /api/sessions/{id}/video` - Delete video

### Sensor Data

- `POST /api/sessions/{id}/sensor-data` - Upload sensor samples
- `GET /api/sessions/{id}/sensor-data` - Get sensor data (with filtering)
- `GET /api/sessions/{id}/sensor-data/stats` - Get sensor data statistics
- `DELETE /api/sessions/{id}/sensor-data` - Delete sensor data

## Data Models

### Session

```json
{
  "id": 1,
  "created_at": "2026-02-09T10:00:00Z",
  "started_at": "2026-02-09T10:00:00Z",
  "ended_at": "2026-02-09T10:05:00Z",
  "duration": 300.0,
  "status": "completed",
  "has_video": true,
  "has_watch_data": true,
  "has_arduino_data": false,
  "metadata": {}
}
```

### Sensor Sample

```json
{
  "source": "watch",
  "relative_time_ms": 1000,
  "accel_x": 0.5,
  "accel_y": -0.2,
  "accel_z": 9.8,
  "gyro_x": 0.1,
  "gyro_y": 0.0,
  "gyro_z": -0.05,
  "orientation_roll": 0.0,
  "orientation_pitch": 0.1,
  "orientation_yaw": 1.57,
  "heart_rate": 75.0
}
```

## Storage

- Database: `storage/sensor_recordings.db`
- Videos: `storage/videos/{session_id}/recording.mp4`

## Development

### Running tests

```bash
pytest
```

### Project structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings
│   ├── database.py          # Database setup
│   ├── models/              # SQLAlchemy models
│   │   └── session.py
│   ├── schemas/             # Pydantic schemas
│   │   └── session.py
│   └── routers/             # API routes
│       ├── sessions.py
│       ├── videos.py
│       └── sensor_data.py
├── storage/                 # Data storage
│   ├── videos/
│   └── sensor_recordings.db
├── requirements.txt
└── README.md
```

## Production Deployment

For production, update `app/config.py` to use PostgreSQL:

```python
database_url: str = "postgresql+asyncpg://user:pass@localhost/dbname"
```

And install additional dependencies:

```bash
pip install asyncpg psycopg2-binary
```
