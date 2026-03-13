/**
 * Sensor Data API
 *
 * Handles uploading and retrieving sensor data from the backend.
 */

import { get, post } from './client';

// Types matching backend schemas
export interface SensorSampleCreate {
  source: 'watch' | 'arduino';
  relative_time_ms: number;
  absolute_timestamp?: string; // ISO datetime

  // Accelerometer (g)
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;

  // Gyroscope (degrees/second)
  gyro_x?: number;
  gyro_y?: number;
  gyro_z?: number;

  // Orientation (radians)
  orientation_roll?: number;
  orientation_pitch?: number;
  orientation_yaw?: number;

  // Heart rate (BPM, watch only)
  heart_rate?: number;
}

export interface SensorDataUploadRequest {
  samples: SensorSampleCreate[];
}

export interface SensorDataUploadResponse {
  session_id: number;
  samples_created: number;
  source: string;
}

export interface SensorSampleResponse {
  id: number;
  session_id: number;
  source: string;
  relative_time_ms: number;
  absolute_timestamp: string | null;
  accel_x: number | null;
  accel_y: number | null;
  accel_z: number | null;
  gyro_x: number | null;
  gyro_y: number | null;
  gyro_z: number | null;
  orientation_roll: number | null;
  orientation_pitch: number | null;
  orientation_yaw: number | null;
  heart_rate: number | null;
}

// Note: The backend returns an array of SensorSampleResponse directly
// This type alias makes it clear
export type SensorDataResponse = SensorSampleResponse[];

export interface GetSensorDataParams {
  source?: 'watch' | 'arduino' | 'all';
  start_time?: number;
  end_time?: number;
  limit?: number;
}

/**
 * Upload sensor data for a session
 */
export async function uploadSensorData(
  sessionId: number,
  data: SensorDataUploadRequest
): Promise<SensorDataUploadResponse> {
  return post<SensorDataUploadResponse>(`/api/sessions/${sessionId}/sensor-data`, data);
}

/**
 * Get sensor data for a session
 */
export async function getSensorData(
  sessionId: number,
  params?: GetSensorDataParams
): Promise<SensorDataResponse> {
  return get<SensorDataResponse>(
    `/api/sessions/${sessionId}/sensor-data`,
    params as Record<string, string | number>
  );
}

/**
 * Convert local sensor sample format to API format
 */
export function convertToApiFormat(
  sample: {
    t: number;
    source: 'watch' | 'arduino';
    accel?: { x: number; y: number; z: number };
    gyro?: { x: number; y: number; z: number };
    orientation?: { roll: number; pitch: number; yaw: number };
    heartRate?: number;
  },
  sessionStartTime: number
): SensorSampleCreate {
  return {
    source: sample.source,
    relative_time_ms: sample.t,
    absolute_timestamp: new Date(sessionStartTime + sample.t).toISOString(),
    accel_x: sample.accel?.x,
    accel_y: sample.accel?.y,
    accel_z: sample.accel?.z,
    gyro_x: sample.gyro?.x,
    gyro_y: sample.gyro?.y,
    gyro_z: sample.gyro?.z,
    orientation_roll: sample.orientation?.roll,
    orientation_pitch: sample.orientation?.pitch,
    orientation_yaw: sample.orientation?.yaw,
    heart_rate: sample.heartRate,
  };
}
