/**
 * Pain Notes API
 *
 * Handles uploading and retrieving voice-recorded pain notes from the backend.
 */

import { get, post } from './client';
import type { PainNote } from '../../types/session';

// Types matching backend schemas
export interface PainNoteCreate {
  note_id: string;           // Original UUID from Watch
  relative_time_ms: number;  // Time relative to session start
  text: string;              // Transcribed text
  pain_level: number;        // Pain severity 1-10
}

export interface PainNotesUploadRequest {
  pain_notes: PainNoteCreate[];
}

export interface PainNotesUploadResponse {
  session_id: number;
  notes_created: number;
}

export interface PainNoteResponse {
  id: number;
  session_id: number;
  note_id: string;
  relative_time_ms: number;
  text: string;
  pain_level: number;
  created_at: string;
}

export type PainNotesResponse = PainNoteResponse[];

export interface GetPainNotesParams {
  start_time?: number;
  end_time?: number;
}

/**
 * Upload pain notes for a session
 */
export async function uploadPainNotes(
  sessionId: number,
  data: PainNotesUploadRequest
): Promise<PainNotesUploadResponse> {
  return post<PainNotesUploadResponse>(`/api/sessions/${sessionId}/pain-notes`, data);
}

/**
 * Get pain notes for a session
 */
export async function getPainNotes(
  sessionId: number,
  params?: GetPainNotesParams
): Promise<PainNotesResponse> {
  return get<PainNotesResponse>(
    `/api/sessions/${sessionId}/pain-notes`,
    params as Record<string, string | number>
  );
}

/**
 * Convert local PainNote format to API format
 */
export function convertPainNoteToApiFormat(note: PainNote): PainNoteCreate {
  return {
    note_id: note.id,
    relative_time_ms: note.timestamp,
    text: note.text,
    pain_level: note.painLevel,
  };
}
