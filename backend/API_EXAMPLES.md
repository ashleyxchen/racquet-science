# API Examples

Example curl commands for testing the backend API.

## Prerequisites

Start the server:
```bash
uvicorn app.main:app --reload
```

## Session Management

### Create a new session

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "started_at": "2026-02-09T10:00:00Z",
    "metadata": {"device": "iPhone 15", "version": "1.0"}
  }'
```

Response:
```json
{
  "id": 1,
  "created_at": "2026-02-09T10:00:00Z",
  "updated_at": "2026-02-09T10:00:00Z",
  "started_at": "2026-02-09T10:00:00Z",
  "ended_at": null,
  "duration": null,
  "status": "created",
  "has_video": false,
  "has_watch_data": false,
  "has_arduino_data": false,
  "video_path": null,
  "metadata": {"device": "iPhone 15", "version": "1.0"},
  "sample_count": 0
}
```

### List sessions

```bash
curl http://localhost:8000/api/sessions
```

With pagination:
```bash
curl "http://localhost:8000/api/sessions?skip=0&limit=10"
```

### Get a specific session

```bash
curl http://localhost:8000/api/sessions/1
```

### Update a session

```bash
curl -X PATCH http://localhost:8000/api/sessions/1 \
  -H "Content-Type: application/json" \
  -d '{
    "ended_at": "2026-02-09T10:05:00Z",
    "duration": 300.0,
    "status": "completed"
  }'
```

### Delete a session

```bash
curl -X DELETE http://localhost:8000/api/sessions/1
```

## Video Management

### Upload a video

```bash
curl -X POST http://localhost:8000/api/sessions/1/video \
  -F "video=@/path/to/video.mp4"
```

Response:
```json
{
  "message": "Video uploaded successfully",
  "session_id": 1,
  "video_path": "storage/videos/1/recording.mp4",
  "file_size": 12345678
}
```

### Download/stream a video

```bash
curl http://localhost:8000/api/sessions/1/video -o downloaded_video.mp4
```

### Delete a video

```bash
curl -X DELETE http://localhost:8000/api/sessions/1/video
```

## Sensor Data

### Upload sensor data

```bash
curl -X POST http://localhost:8000/api/sessions/1/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "samples": [
      {
        "source": "watch",
        "relative_time_ms": 0,
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
      },
      {
        "source": "watch",
        "relative_time_ms": 100,
        "accel_x": 0.6,
        "accel_y": -0.3,
        "accel_z": 9.7,
        "gyro_x": 0.15,
        "gyro_y": 0.05,
        "gyro_z": -0.1,
        "heart_rate": 76.0
      }
    ]
  }'
```

Response:
```json
{
  "message": "Sensor data uploaded successfully",
  "session_id": 1,
  "samples_uploaded": 2,
  "sources": ["watch"]
}
```

### Get sensor data

All data:
```bash
curl http://localhost:8000/api/sessions/1/sensor-data
```

Filter by source:
```bash
curl "http://localhost:8000/api/sessions/1/sensor-data?source=watch"
```

With pagination:
```bash
curl "http://localhost:8000/api/sessions/1/sensor-data?skip=0&limit=100"
```

### Get sensor data statistics

```bash
curl http://localhost:8000/api/sessions/1/sensor-data/stats
```

Response:
```json
{
  "session_id": 1,
  "total_samples": 150,
  "watch_samples": 100,
  "arduino_samples": 50,
  "time_range": {
    "start_ms": 0,
    "end_ms": 15000,
    "duration_ms": 15000
  },
  "has_watch_data": true,
  "has_arduino_data": true
}
```

### Delete sensor data

Delete all sensor data:
```bash
curl -X DELETE http://localhost:8000/api/sessions/1/sensor-data
```

Delete only watch data:
```bash
curl -X DELETE "http://localhost:8000/api/sessions/1/sensor-data?source=watch"
```

Delete only arduino data:
```bash
curl -X DELETE "http://localhost:8000/api/sessions/1/sensor-data?source=arduino"
```

## Complete Workflow Example

```bash
# 1. Create a session
SESSION_ID=$(curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"started_at": "2026-02-09T10:00:00Z"}' \
  | jq -r '.id')

echo "Created session: $SESSION_ID"

# 2. Upload sensor data
curl -X POST http://localhost:8000/api/sessions/$SESSION_ID/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "samples": [
      {"source": "watch", "relative_time_ms": 0, "accel_x": 0.5, "accel_y": -0.2, "accel_z": 9.8},
      {"source": "watch", "relative_time_ms": 100, "accel_x": 0.6, "accel_y": -0.3, "accel_z": 9.7}
    ]
  }'

# 3. Upload video
curl -X POST http://localhost:8000/api/sessions/$SESSION_ID/video \
  -F "video=@recording.mp4"

# 4. Mark session as completed
curl -X PATCH http://localhost:8000/api/sessions/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{
    "ended_at": "2026-02-09T10:05:00Z",
    "duration": 300.0,
    "status": "completed"
  }'

# 5. Get session details
curl http://localhost:8000/api/sessions/$SESSION_ID | jq .

# 6. Get sensor data stats
curl http://localhost:8000/api/sessions/$SESSION_ID/sensor-data/stats | jq .
```

## Health Checks

```bash
# Root endpoint
curl http://localhost:8000/

# Health check
curl http://localhost:8000/health
```

## API Documentation

Interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
