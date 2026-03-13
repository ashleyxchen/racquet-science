"""FSR (Force Sensing Resistor) data router.

Handles uploading and retrieving FSR pressure grid data (4x8 = 32 values per frame).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.database import get_db
from app.models import Session, FSRSample
from app.schemas import FSRDataUpload, FSRSampleResponse, FSRDataUploadResponse

router = APIRouter(prefix="/api/sessions", tags=["fsr-data"])


@router.post("/{session_id}/fsr-data", response_model=FSRDataUploadResponse, status_code=201)
async def upload_fsr_data(
    session_id: int,
    data: FSRDataUpload,
    db: AsyncSession = Depends(get_db)
):
    """
    Upload FSR pressure grid data samples for a session.

    Each sample contains 32 integer values representing a 4x8 grid of pressure sensors.
    Supports bulk upload of multiple samples.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Prepare FSR samples for bulk insert
    fsr_samples = []
    for sample in data.samples:
        fsr_sample = FSRSample(
            session_id=session_id,
            relative_time_ms=sample.relative_time_ms,
            sequence=sample.sequence,
            values=sample.values,
        )
        fsr_samples.append(fsr_sample)

    # Bulk insert
    db.add_all(fsr_samples)

    # Update session flag
    session.has_fsr_data = True

    await db.flush()

    return FSRDataUploadResponse(
        session_id=session_id,
        samples_created=len(fsr_samples)
    )


@router.get("/{session_id}/fsr-data", response_model=List[FSRSampleResponse])
async def get_fsr_data(
    session_id: int,
    start_time: Optional[int] = Query(None, ge=0, description="Filter samples with relative_time_ms >= start_time"),
    end_time: Optional[int] = Query(None, ge=0, description="Filter samples with relative_time_ms <= end_time"),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=100000),
    db: AsyncSession = Depends(get_db)
):
    """
    Get FSR data for a session.

    Optionally filter by time range.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build query
    query = select(FSRSample).where(FSRSample.session_id == session_id)

    if start_time is not None:
        query = query.where(FSRSample.relative_time_ms >= start_time)
    if end_time is not None:
        query = query.where(FSRSample.relative_time_ms <= end_time)

    query = query.order_by(FSRSample.relative_time_ms).offset(skip).limit(limit)

    result = await db.execute(query)
    samples = result.scalars().all()

    return samples


@router.get("/{session_id}/fsr-data/stats")
async def get_fsr_data_stats(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about FSR data for a session.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all FSR samples ordered by time
    query = select(FSRSample).where(FSRSample.session_id == session_id).order_by(
        FSRSample.relative_time_ms
    )
    result = await db.execute(query)
    samples = result.scalars().all()

    time_range = None
    if samples:
        time_range = {
            "start_ms": samples[0].relative_time_ms,
            "end_ms": samples[-1].relative_time_ms,
            "duration_ms": samples[-1].relative_time_ms - samples[0].relative_time_ms
        }

    return {
        "session_id": session_id,
        "total_samples": len(samples),
        "time_range": time_range,
        "has_fsr_data": len(samples) > 0,
        "grid_size": {"rows": 4, "cols": 8, "total": 32}
    }


@router.delete("/{session_id}/fsr-data", status_code=204)
async def delete_fsr_data(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all FSR data for a session.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete all FSR samples
    samples_query = select(FSRSample).where(FSRSample.session_id == session_id)
    result = await db.execute(samples_query)
    samples = result.scalars().all()

    for sample in samples:
        await db.delete(sample)

    # Update session flag
    session.has_fsr_data = False

    await db.flush()

    return None
