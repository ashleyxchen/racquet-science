from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.database import get_db
from app.models import Session, SensorSample
from app.schemas import SensorDataUpload, SensorSampleResponse

router = APIRouter(prefix="/api/sessions", tags=["sensor-data"])


@router.post("/{session_id}/sensor-data", status_code=201)
async def upload_sensor_data(
    session_id: int,
    data: SensorDataUpload,
    db: AsyncSession = Depends(get_db)
):
    """
    Upload sensor data samples for a session.
    Supports bulk upload of multiple samples.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Prepare sensor samples for bulk insert
    sensor_samples = []
    has_watch = False
    has_arduino = False

    for sample in data.samples:
        sensor_sample = SensorSample(
            session_id=session_id,
            source=sample.source,
            relative_time_ms=sample.relative_time_ms,
            absolute_timestamp=sample.absolute_timestamp,
            accel_x=sample.accel_x,
            accel_y=sample.accel_y,
            accel_z=sample.accel_z,
            gyro_x=sample.gyro_x,
            gyro_y=sample.gyro_y,
            gyro_z=sample.gyro_z,
            orientation_roll=sample.orientation_roll,
            orientation_pitch=sample.orientation_pitch,
            orientation_yaw=sample.orientation_yaw,
            heart_rate=sample.heart_rate,
        )
        sensor_samples.append(sensor_sample)

        if sample.source == "watch":
            has_watch = True
        elif sample.source == "arduino":
            has_arduino = True

    # Bulk insert
    db.add_all(sensor_samples)

    # Update session flags
    if has_watch:
        session.has_watch_data = True
    if has_arduino:
        session.has_arduino_data = True

    await db.flush()

    return {
        "message": "Sensor data uploaded successfully",
        "session_id": session_id,
        "samples_uploaded": len(sensor_samples),
        "sources": list(set(sample.source for sample in data.samples))
    }


@router.get("/{session_id}/sensor-data", response_model=List[SensorSampleResponse])
async def get_sensor_data(
    session_id: int,
    source: Optional[str] = Query(None, pattern="^(watch|arduino)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=100000),
    db: AsyncSession = Depends(get_db)
):
    """
    Get sensor data for a session.
    Optionally filter by source (watch or arduino).
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build query
    query = select(SensorSample).where(SensorSample.session_id == session_id)

    if source:
        query = query.where(SensorSample.source == source)

    query = query.order_by(SensorSample.relative_time_ms).offset(skip).limit(limit)

    result = await db.execute(query)
    samples = result.scalars().all()

    return samples


@router.get("/{session_id}/sensor-data/stats")
async def get_sensor_data_stats(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about sensor data for a session.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get counts by source
    watch_query = select(SensorSample).where(
        SensorSample.session_id == session_id,
        SensorSample.source == "watch"
    )
    watch_result = await db.execute(watch_query)
    watch_samples = watch_result.scalars().all()

    arduino_query = select(SensorSample).where(
        SensorSample.session_id == session_id,
        SensorSample.source == "arduino"
    )
    arduino_result = await db.execute(arduino_query)
    arduino_samples = arduino_result.scalars().all()

    # Calculate time range
    all_query = select(SensorSample).where(SensorSample.session_id == session_id).order_by(
        SensorSample.relative_time_ms
    )
    all_result = await db.execute(all_query)
    all_samples = all_result.scalars().all()

    time_range = None
    if all_samples:
        time_range = {
            "start_ms": all_samples[0].relative_time_ms,
            "end_ms": all_samples[-1].relative_time_ms,
            "duration_ms": all_samples[-1].relative_time_ms - all_samples[0].relative_time_ms
        }

    return {
        "session_id": session_id,
        "total_samples": len(all_samples),
        "watch_samples": len(watch_samples),
        "arduino_samples": len(arduino_samples),
        "time_range": time_range,
        "has_watch_data": len(watch_samples) > 0,
        "has_arduino_data": len(arduino_samples) > 0
    }


@router.delete("/{session_id}/sensor-data", status_code=204)
async def delete_sensor_data(
    session_id: int,
    source: Optional[str] = Query(None, pattern="^(watch|arduino)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete sensor data for a session.
    Optionally filter by source to delete only watch or arduino data.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build delete query
    if source:
        # Delete only specific source
        samples_to_delete = select(SensorSample).where(
            SensorSample.session_id == session_id,
            SensorSample.source == source
        )
        result = await db.execute(samples_to_delete)
        samples = result.scalars().all()

        for sample in samples:
            await db.delete(sample)

        # Update session flags
        if source == "watch":
            session.has_watch_data = False
        elif source == "arduino":
            session.has_arduino_data = False
    else:
        # Delete all sensor data
        samples_to_delete = select(SensorSample).where(SensorSample.session_id == session_id)
        result = await db.execute(samples_to_delete)
        samples = result.scalars().all()

        for sample in samples:
            await db.delete(sample)

        session.has_watch_data = False
        session.has_arduino_data = False

    await db.flush()

    return None
