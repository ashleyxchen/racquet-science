/**
 * Sessions API
 *
 * Handles all session-related API operations.
 */

import { get, post, patch, del } from './client';

// Types matching backend schemas
export interface SessionMetadata {
  [key: string]: unknown;
}

export interface SessionCreateRequest {
  started_at?: string; // ISO datetime
  session_metadata?: SessionMetadata;
  planned_duration?: number; // Planned duration in minutes
  recording_started_by?: 'phone' | 'watch';
}

export interface CalibrationSample {
  timestamp: number;
  force: number;
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;
  gyro_x?: number;
  gyro_y?: number;
  gyro_z?: number;
}

export interface CalibrationUploadRequest {
  max_force: number;
  timestamp: string; // ISO datetime
  duration_ms: number;
  samples?: CalibrationSample[];
  is_post_session?: boolean; // True for post-session calibration
}

export interface SessionUpdateRequest {
  ended_at?: string; // ISO datetime
  duration?: number;
  status?: string;
  session_metadata?: SessionMetadata;
}

export interface SessionResponse {
  id: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration: number | null;
  status: string;
  has_video: boolean;
  has_watch_data: boolean;
  has_arduino_data: boolean;
  has_fsr_data: boolean;
  has_pain_notes: boolean;
  video_path: string | null;
  session_metadata: SessionMetadata | null;
  sample_count: number | null;
  fsr_frame_count: number | null;
  pain_note_count: number | null;
  // Wizard/Planning fields
  planned_duration: number | null;
  recording_started_by: string | null;
  // Pre-session calibration fields
  calibration_max_force: number | null;
  calibration_timestamp: string | null;
  calibration_duration_ms: number | null;
  // Post-session calibration fields
  post_calibration_max_force: number | null;
  post_calibration_timestamp: string | null;
  post_calibration_duration_ms: number | null;
}

export interface SessionListResponse {
  sessions: SessionResponse[];
  total: number;
  skip: number;
  limit: number;
}

export interface ListSessionsParams {
  skip?: number;
  limit?: number;
}

/**
 * Create a new session on the backend
 */
export async function createSession(data: SessionCreateRequest): Promise<SessionResponse> {
  return post<SessionResponse>('/api/sessions', data);
}

/**
 * List sessions with pagination
 */
export async function listSessions(params?: ListSessionsParams): Promise<SessionListResponse> {
  return get<SessionListResponse>('/api/sessions', params as Record<string, string | number>);
}

/**
 * Get a single session by ID
 */
export async function getSession(sessionId: number): Promise<SessionResponse> {
  return get<SessionResponse>(`/api/sessions/${sessionId}`);
}

/**
 * Update a session
 */
export async function updateSession(sessionId: number, data: SessionUpdateRequest): Promise<SessionResponse> {
  return patch<SessionResponse>(`/api/sessions/${sessionId}`, data);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: number): Promise<void> {
  return del<void>(`/api/sessions/${sessionId}`);
}

/**
 * Upload calibration data for a session
 */
export async function uploadCalibration(
  sessionId: number,
  data: CalibrationUploadRequest
): Promise<SessionResponse> {
  return post<SessionResponse>(`/api/sessions/${sessionId}/calibration`, data);
}
