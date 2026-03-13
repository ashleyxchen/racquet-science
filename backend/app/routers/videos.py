from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path
import aiofiles
import os

from app.database import get_db
from app.models import Session
from app.config import settings

router = APIRouter(prefix="/api/sessions", tags=["videos"])


@router.post("/{session_id}/video", status_code=201)
async def upload_video(
    session_id: int,
    video: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a video file for a session.
    Accepts video in multipart/form-data format.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate file type
    if not video.content_type or not video.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")

    # Create session directory
    session_dir = settings.storage_path / str(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)

    # Determine file extension
    file_extension = Path(video.filename).suffix if video.filename else '.mp4'
    if not file_extension:
        file_extension = '.mp4'

    # Save video file
    video_filename = f"recording{file_extension}"
    video_path = session_dir / video_filename

    # Delete old video if exists
    if session.video_path and Path(session.video_path).exists():
        os.remove(session.video_path)

    # Write file in chunks
    async with aiofiles.open(video_path, 'wb') as f:
        while chunk := await video.read(1024 * 1024):  # Read 1MB at a time
            await f.write(chunk)

    # Update session
    session.video_path = str(video_path)
    session.has_video = True
    await db.flush()

    return {
        "message": "Video uploaded successfully",
        "session_id": session_id,
        "video_path": str(video_path),
        "file_size": video_path.stat().st_size
    }


@router.get("/{session_id}/video")
async def get_video(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Stream or download the video for a session.
    """
    # Get session
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.has_video or not session.video_path:
        raise HTTPException(status_code=404, detail="No video found for this session")

    video_path = Path(session.video_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    # Return video file
    return FileResponse(
        path=video_path,
        media_type="video/mp4",
        filename=f"session_{session_id}_recording{video_path.suffix}"
    )


@router.delete("/{session_id}/video", status_code=204)
async def delete_video(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete the video for a session.
    """
    # Get session
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.has_video or not session.video_path:
        raise HTTPException(status_code=404, detail="No video found for this session")

    # Delete video file
    video_path = Path(session.video_path)
    if video_path.exists():
        os.remove(video_path)

        # Try to remove parent directory if empty
        try:
            video_path.parent.rmdir()
        except OSError:
            pass  # Directory not empty or other error

    # Update session
    session.video_path = None
    session.has_video = False
    await db.flush()

    return None
