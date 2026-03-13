from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.database import get_db
from app.models import Session, PainNote
from app.schemas import PainNotesUpload, PainNoteResponse, PainNotesUploadResponse

router = APIRouter(prefix="/api/sessions", tags=["pain-notes"])


@router.post("/{session_id}/pain-notes", response_model=PainNotesUploadResponse, status_code=201)
async def upload_pain_notes(
    session_id: int,
    data: PainNotesUpload,
    db: AsyncSession = Depends(get_db)
):
    """
    Upload pain notes for a session.
    Supports bulk upload of multiple pain notes.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Prepare pain notes for bulk insert
    pain_notes = []
    for note in data.pain_notes:
        pain_note = PainNote(
            session_id=session_id,
            note_id=note.note_id,
            relative_time_ms=note.relative_time_ms,
            text=note.text,
            pain_level=note.pain_level,
        )
        pain_notes.append(pain_note)

    # Bulk insert
    db.add_all(pain_notes)

    # Update session flag
    session.has_pain_notes = True

    await db.flush()

    return PainNotesUploadResponse(
        session_id=session_id,
        notes_created=len(pain_notes)
    )


@router.get("/{session_id}/pain-notes", response_model=List[PainNoteResponse])
async def get_pain_notes(
    session_id: int,
    start_time: Optional[int] = Query(None, ge=0, description="Filter by start time (ms)"),
    end_time: Optional[int] = Query(None, ge=0, description="Filter by end time (ms)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get pain notes for a session.
    Optionally filter by time range.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build query
    query = select(PainNote).where(PainNote.session_id == session_id)

    if start_time is not None:
        query = query.where(PainNote.relative_time_ms >= start_time)
    if end_time is not None:
        query = query.where(PainNote.relative_time_ms <= end_time)

    query = query.order_by(PainNote.relative_time_ms)

    result = await db.execute(query)
    notes = result.scalars().all()

    return notes


@router.delete("/{session_id}/pain-notes", status_code=204)
async def delete_pain_notes(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all pain notes for a session.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete all pain notes
    notes_query = select(PainNote).where(PainNote.session_id == session_id)
    result = await db.execute(notes_query)
    notes = result.scalars().all()

    for note in notes:
        await db.delete(note)

    # Update session flag
    session.has_pain_notes = False

    await db.flush()

    return None


@router.get("/{session_id}/pain-notes/stats")
async def get_pain_notes_stats(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about pain notes for a session.
    """
    # Verify session exists
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all pain notes
    notes_query = select(PainNote).where(PainNote.session_id == session_id).order_by(
        PainNote.relative_time_ms
    )
    result = await db.execute(notes_query)
    notes = result.scalars().all()

    if not notes:
        return {
            "session_id": session_id,
            "total_notes": 0,
            "avg_pain_level": None,
            "max_pain_level": None,
            "min_pain_level": None,
            "time_range": None
        }

    pain_levels = [note.pain_level for note in notes]

    return {
        "session_id": session_id,
        "total_notes": len(notes),
        "avg_pain_level": sum(pain_levels) / len(pain_levels),
        "max_pain_level": max(pain_levels),
        "min_pain_level": min(pain_levels),
        "time_range": {
            "start_ms": notes[0].relative_time_ms,
            "end_ms": notes[-1].relative_time_ms,
        }
    }
