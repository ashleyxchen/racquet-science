from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from typing import List

from app.database import get_db
from app.models import Session, SensorSample, PainNote
from app.schemas import SessionCreate, SessionResponse, SessionListResponse, SessionUpdate, CalibrationUpload

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new recording session.
    """
    new_session = Session(
        started_at=session_data.started_at,
        session_metadata=session_data.session_metadata,
        planned_duration=session_data.planned_duration,
        recording_started_by=session_data.recording_started_by,
        status="created"
    )

    db.add(new_session)
    await db.flush()
    await db.refresh(new_session)

    response = SessionResponse(
        id=new_session.id,
        created_at=new_session.created_at,
        updated_at=new_session.updated_at,
        started_at=new_session.started_at,
        ended_at=new_session.ended_at,
        duration=new_session.duration,
        status=new_session.status,
        has_video=new_session.has_video,
        has_watch_data=new_session.has_watch_data,
        has_arduino_data=new_session.has_arduino_data,
        has_pain_notes=new_session.has_pain_notes,
        video_path=new_session.video_path,
        session_metadata=new_session.session_metadata,
        sample_count=0,
        pain_note_count=0,
        planned_duration=new_session.planned_duration,
        recording_started_by=new_session.recording_started_by,
        calibration_max_force=new_session.calibration_max_force,
        calibration_timestamp=new_session.calibration_timestamp,
        calibration_duration_ms=new_session.calibration_duration_ms,
        post_calibration_max_force=new_session.post_calibration_max_force,
        post_calibration_timestamp=new_session.post_calibration_timestamp,
        post_calibration_duration_ms=new_session.post_calibration_duration_ms
    )

    return response


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """
    List all recording sessions with pagination.
    """
    # Get total count
    count_query = select(func.count(Session.id))
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get sessions
    query = select(Session).order_by(Session.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()

    # Get sample counts and pain note counts for each session
    session_responses = []
    for session in sessions:
        # Get sensor sample count
        sample_count_query = select(func.count(SensorSample.id)).where(SensorSample.session_id == session.id)
        sample_count_result = await db.execute(sample_count_query)
        sample_count = sample_count_result.scalar_one()

        # Get pain note count
        pain_note_count_query = select(func.count(PainNote.id)).where(PainNote.session_id == session.id)
        pain_note_count_result = await db.execute(pain_note_count_query)
        pain_note_count = pain_note_count_result.scalar_one()

        session_responses.append(SessionResponse(
            id=session.id,
            created_at=session.created_at,
            updated_at=session.updated_at,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration=session.duration,
            status=session.status,
            has_video=session.has_video,
            has_watch_data=session.has_watch_data,
            has_arduino_data=session.has_arduino_data,
            has_pain_notes=session.has_pain_notes,
            video_path=session.video_path,
            session_metadata=session.session_metadata,
            sample_count=sample_count,
            pain_note_count=pain_note_count,
            planned_duration=session.planned_duration,
            recording_started_by=session.recording_started_by,
            calibration_max_force=session.calibration_max_force,
            calibration_timestamp=session.calibration_timestamp,
            calibration_duration_ms=session.calibration_duration_ms,
            post_calibration_max_force=session.post_calibration_max_force,
            post_calibration_timestamp=session.post_calibration_timestamp,
            post_calibration_duration_ms=session.post_calibration_duration_ms
        ))

    return SessionListResponse(
        sessions=session_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific session.
    """
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get sample count
    sample_count_query = select(func.count(SensorSample.id)).where(SensorSample.session_id == session_id)
    sample_count_result = await db.execute(sample_count_query)
    sample_count = sample_count_result.scalar_one()

    # Get pain note count
    pain_note_count_query = select(func.count(PainNote.id)).where(PainNote.session_id == session_id)
    pain_note_count_result = await db.execute(pain_note_count_query)
    pain_note_count = pain_note_count_result.scalar_one()

    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration=session.duration,
        status=session.status,
        has_video=session.has_video,
        has_watch_data=session.has_watch_data,
        has_arduino_data=session.has_arduino_data,
        has_pain_notes=session.has_pain_notes,
        video_path=session.video_path,
        session_metadata=session.session_metadata,
        sample_count=sample_count,
        pain_note_count=pain_note_count,
        planned_duration=session.planned_duration,
        recording_started_by=session.recording_started_by,
        calibration_max_force=session.calibration_max_force,
        calibration_timestamp=session.calibration_timestamp,
        calibration_duration_ms=session.calibration_duration_ms,
        post_calibration_max_force=session.post_calibration_max_force,
        post_calibration_timestamp=session.post_calibration_timestamp,
        post_calibration_duration_ms=session.post_calibration_duration_ms
    )


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    session_update: SessionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update session details.
    """
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update fields
    if session_update.ended_at is not None:
        session.ended_at = session_update.ended_at
    if session_update.duration is not None:
        session.duration = session_update.duration
    if session_update.status is not None:
        session.status = session_update.status
    if session_update.session_metadata is not None:
        # Merge new metadata with existing metadata instead of replacing
        existing_metadata = session.session_metadata or {}
        session.session_metadata = {**existing_metadata, **session_update.session_metadata}

    await db.flush()
    await db.refresh(session)

    # Get sample count
    sample_count_query = select(func.count(SensorSample.id)).where(SensorSample.session_id == session_id)
    sample_count_result = await db.execute(sample_count_query)
    sample_count = sample_count_result.scalar_one()

    # Get pain note count
    pain_note_count_query = select(func.count(PainNote.id)).where(PainNote.session_id == session_id)
    pain_note_count_result = await db.execute(pain_note_count_query)
    pain_note_count = pain_note_count_result.scalar_one()

    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration=session.duration,
        status=session.status,
        has_video=session.has_video,
        has_watch_data=session.has_watch_data,
        has_arduino_data=session.has_arduino_data,
        has_pain_notes=session.has_pain_notes,
        video_path=session.video_path,
        session_metadata=session.session_metadata,
        sample_count=sample_count,
        pain_note_count=pain_note_count,
        planned_duration=session.planned_duration,
        recording_started_by=session.recording_started_by,
        calibration_max_force=session.calibration_max_force,
        calibration_timestamp=session.calibration_timestamp,
        calibration_duration_ms=session.calibration_duration_ms,
        post_calibration_max_force=session.post_calibration_max_force,
        post_calibration_timestamp=session.post_calibration_timestamp,
        post_calibration_duration_ms=session.post_calibration_duration_ms
    )


@router.post("/{session_id}/calibration", response_model=SessionResponse)
async def upload_calibration(
    session_id: int,
    calibration_data: CalibrationUpload,
    db: AsyncSession = Depends(get_db)
):
    """
    Upload calibration data for a session.
    Supports both pre-session and post-session calibration via is_post_session flag.
    """
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update appropriate calibration fields based on is_post_session flag
    if calibration_data.is_post_session:
        # Post-session calibration
        session.post_calibration_max_force = calibration_data.max_force
        session.post_calibration_timestamp = calibration_data.timestamp
        session.post_calibration_duration_ms = calibration_data.duration_ms
        # Note: post-calibration samples not stored separately for now
    else:
        # Pre-session calibration
        session.calibration_max_force = calibration_data.max_force
        session.calibration_timestamp = calibration_data.timestamp
        session.calibration_duration_ms = calibration_data.duration_ms

        # Store samples as JSON if provided (pre-session only)
        if calibration_data.samples:
            session.calibration_samples = [
                {
                    "timestamp": s.timestamp,
                    "force": s.force,
                    "accel_x": s.accel_x,
                    "accel_y": s.accel_y,
                    "accel_z": s.accel_z,
                    "gyro_x": s.gyro_x,
                    "gyro_y": s.gyro_y,
                    "gyro_z": s.gyro_z
                }
                for s in calibration_data.samples
            ]

    await db.flush()
    await db.refresh(session)

    # Get sample count
    sample_count_query = select(func.count(SensorSample.id)).where(SensorSample.session_id == session_id)
    sample_count_result = await db.execute(sample_count_query)
    sample_count = sample_count_result.scalar_one()

    # Get pain note count
    pain_note_count_query = select(func.count(PainNote.id)).where(PainNote.session_id == session_id)
    pain_note_count_result = await db.execute(pain_note_count_query)
    pain_note_count = pain_note_count_result.scalar_one()

    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration=session.duration,
        status=session.status,
        has_video=session.has_video,
        has_watch_data=session.has_watch_data,
        has_arduino_data=session.has_arduino_data,
        has_pain_notes=session.has_pain_notes,
        video_path=session.video_path,
        session_metadata=session.session_metadata,
        sample_count=sample_count,
        pain_note_count=pain_note_count,
        planned_duration=session.planned_duration,
        recording_started_by=session.recording_started_by,
        calibration_max_force=session.calibration_max_force,
        calibration_timestamp=session.calibration_timestamp,
        calibration_duration_ms=session.calibration_duration_ms,
        post_calibration_max_force=session.post_calibration_max_force,
        post_calibration_timestamp=session.post_calibration_timestamp,
        post_calibration_duration_ms=session.post_calibration_duration_ms
    )


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a session and all associated data.
    """
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete video file if exists
    if session.video_path:
        import os
        from pathlib import Path
        video_path = Path(session.video_path)
        if video_path.exists():
            os.remove(video_path)
            # Try to remove parent directory if empty
            try:
                video_path.parent.rmdir()
            except OSError:
                pass  # Directory not empty or other error

    # Delete session (cascades to sensor samples)
    await db.delete(session)
    await db.flush()

    return None
