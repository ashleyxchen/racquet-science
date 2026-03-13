/**
 * FSR Data API
 *
 * Handles uploading and retrieving FSR pressure grid data from the backend.
 */

import { get, post } from './client';

// Types matching backend schemas
export interface FSRSampleCreate {
  relative_time_ms: number;
  sequence: number;
  values: number[]; // 32 values (4x8 grid, row-major order)
}

export interface FSRDataUploadRequest {
  samples: FSRSampleCreate[];
}

export interface FSRDataUploadResponse {
  session_id: number;
  samples_created: number;
}

export interface FSRSampleResponse {
  id: number;
  session_id: number;
  relative_time_ms: number;
  sequence: number;
  values: number[];
}

export type FSRDataResponse = FSRSampleResponse[];

export interface GetFSRDataParams {
  start_time?: number;
  end_time?: number;
  limit?: number;
}

/**
 * Upload FSR data for a session
 */
export async function uploadFSRData(
  sessionId: number,
  data: FSRDataUploadRequest
): Promise<FSRDataUploadResponse> {
  return post<FSRDataUploadResponse>(`/api/sessions/${sessionId}/fsr-data`, data);
}

/**
 * Get FSR data for a session
 */
export async function getFSRData(
  sessionId: number,
  params?: GetFSRDataParams
): Promise<FSRDataResponse> {
  return get<FSRDataResponse>(
    `/api/sessions/${sessionId}/fsr-data`,
    params as Record<string, string | number>
  );
}

/**
 * Convert local FSR sample format to API format
 */
export function convertFSRToApiFormat(
  sample: {
    t: number;
    seq: number;
    values: number[];
  }
): FSRSampleCreate {
  return {
    relative_time_ms: sample.t,
    sequence: sample.seq,
    values: sample.values,
  };
}
