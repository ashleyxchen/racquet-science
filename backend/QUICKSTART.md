# Backend Quick Start Guide

Get the FastAPI backend running in 3 minutes.

## Installation

### 1. Create and activate virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Verify setup

```bash
python test_setup.py
```

You should see:
```
✓ All imports successful
✓ Database initialized successfully
✓ All tests passed! Backend is ready to use.
```

## Running the Server

### Option 1: Using the convenience script

```bash
./run.sh
```

### Option 2: Using uvicorn directly

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at: http://localhost:8000

## Verify it's working

Open your browser to:
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

Or use curl:
```bash
curl http://localhost:8000/health
```

## Create Sample Data

To create a sample session with sensor data:

```bash
python create_sample_data.py
```

This creates a session with 300 watch samples and 150 Arduino samples.

## Test the API

### Create a session

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"test": "data"}}'
```

### List sessions

```bash
curl http://localhost:8000/api/sessions
```

For more examples, see [API_EXAMPLES.md](API_EXAMPLES.md)

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── database.py          # Database setup
│   ├── config.py            # Configuration
│   ├── models/              # SQLAlchemy models
│   │   └── session.py       # Session and SensorSample models
│   ├── schemas/             # Pydantic schemas
│   │   └── session.py       # Request/response schemas
│   └── routers/             # API routes
│       ├── sessions.py      # Session CRUD
│       ├── videos.py        # Video upload/download
│       └── sensor_data.py   # Sensor data operations
├── storage/                 # Data storage
│   ├── videos/             # Video files
│   └── sensor_recordings.db # SQLite database
├── requirements.txt         # Python dependencies
└── README.md               # Full documentation
```

## Available Endpoints

### Sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions
- `GET /api/sessions/{id}` - Get session
- `PATCH /api/sessions/{id}` - Update session
- `DELETE /api/sessions/{id}` - Delete session

### Videos
- `POST /api/sessions/{id}/video` - Upload video
- `GET /api/sessions/{id}/video` - Download video
- `DELETE /api/sessions/{id}/video` - Delete video

### Sensor Data
- `POST /api/sessions/{id}/sensor-data` - Upload data
- `GET /api/sessions/{id}/sensor-data` - Get data
- `GET /api/sessions/{id}/sensor-data/stats` - Get stats
- `DELETE /api/sessions/{id}/sensor-data` - Delete data

## Development

### Run tests

```bash
pip install -r requirements-dev.txt
pytest
```

### Interactive API docs

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Troubleshooting

### Port already in use

If port 8000 is already in use, specify a different port:

```bash
uvicorn app.main:app --reload --port 8080
```

### Database issues

Delete the database and restart:

```bash
rm -rf storage/sensor_recordings.db*
python test_setup.py
```

### Import errors

Make sure you're in the virtual environment:

```bash
source venv/bin/activate
```

And all dependencies are installed:

```bash
pip install -r requirements.txt
```

## Next Steps

1. Check out the [API Examples](API_EXAMPLES.md) for more usage examples
2. Read the [README](README.md) for detailed documentation
3. Explore the interactive API docs at http://localhost:8000/docs
4. Start integrating with the mobile app!

## Production Deployment

For production:

1. Switch to PostgreSQL (see README.md)
2. Set proper CORS origins in `app/main.py`
3. Use production ASGI server (gunicorn with uvicorn workers)
4. Set up proper environment variables
5. Use Docker (see Dockerfile)

```bash
docker build -t sensor-backend .
docker run -p 8000:8000 sensor-backend
```
