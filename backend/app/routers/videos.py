from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Header
from fastapi.responses import FileResponse, StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path
import aiofiles
import os
from typing import Optional

from app.database import get_db
from app.models import Session
from app.config import settings

router = APIRouter(prefix="/api/sessions", tags=["videos"])


def parse_range_header(range_header: str, file_size: int) -> tuple[int, int]:
    """Parse HTTP Range header and return start and end byte positions."""
    # Range header format: "bytes=start-end" or "bytes=start-"
    range_str = range_header.replace("bytes=", "")
    parts = range_str.split("-")

    start = int(parts[0]) if parts[0] else 0
    end = int(parts[1]) if parts[1] else file_size - 1

    # Clamp values
    start = max(0, min(start, file_size - 1))
    end = max(start, min(end, file_size - 1))

    return start, end


async def ranged_file_response(
    file_path: Path,
    range_header: Optional[str],
    media_type: str = "video/mp4"
) -> Response:
    """
    Return a file response that supports HTTP Range requests.
    Required for video streaming on iOS Safari.
    """
    file_size = file_path.stat().st_size

    if range_header:
        # Parse range header
        start, end = parse_range_header(range_header, file_size)
        chunk_size = end - start + 1

        # Read the requested range
        async with aiofiles.open(file_path, 'rb') as f:
            await f.seek(start)
            content = await f.read(chunk_size)

        # Return 206 Partial Content
        return Response(
            content=content,
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
            }
        )
    else:
        # No range header - return full file with Accept-Ranges header
        async with aiofiles.open(file_path, 'rb') as f:
            content = await f.read()

        return Response(
            content=content,
            status_code=200,
            media_type=media_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            }
        )


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
    db: AsyncSession = Depends(get_db),
    range: Optional[str] = Header(None)
):
    """
    Stream or download the video for a session.
    Supports HTTP Range requests for iOS Safari video playback.
    """
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"[VIDEO] GET /sessions/{session_id}/video - Range header: {range}")

    # Get session
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        logger.error(f"[VIDEO] Session {session_id} not found")
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.has_video or not session.video_path:
        logger.error(f"[VIDEO] Session {session_id} has no video (has_video={session.has_video}, video_path={session.video_path})")
        raise HTTPException(status_code=404, detail="No video found for this session")

    video_path = Path(session.video_path)
    if not video_path.exists():
        logger.error(f"[VIDEO] Video file not found on disk: {video_path}")
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    file_size = video_path.stat().st_size
    logger.info(f"[VIDEO] Serving video: {video_path} (size: {file_size} bytes)")

    # Return video file with Range request support
    return await ranged_file_response(video_path, range, media_type="video/mp4")


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
