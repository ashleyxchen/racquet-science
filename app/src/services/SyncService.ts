/**
 * Sync Service
 *
 * Orchestrates syncing recorded sessions to the backend.
 * Handles the full flow: create session -> upload sensor data -> upload video
 */

import {
  checkHealth,
  createSession,
  updateSession,
  uploadSensorData,
  uploadVideo,
  uploadCalibration,
  uploadFSRData,
  uploadPainNotes,
  convertToApiFormat,
  convertFSRToApiFormat,
  convertPainNoteToApiFormat,
  ApiClientError,
  type SessionResponse,
  type SensorSampleCreate,
  type CalibrationUploadRequest,
  type FSRSampleCreate,
} from './api';
import type { RecordingSessionResult } from '../hooks/useRecordingSession';
import type { SensorSample, SessionMetadata, FSRSample, PainNote } from '../types/session';
import type { CalibrationData } from '../types/recordingWizard';

export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'success' | 'error';

export interface SyncProgress {
  status: SyncStatus;
  step: 'idle' | 'creating_session' | 'uploading_calibration' | 'uploading_sensor_data' | 'uploading_fsr_data' | 'uploading_pain_notes' | 'uploading_video' | 'finalizing' | 'done';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  backendSessionId?: number;
  error?: string;
  details?: {
    sessionCreated: boolean;
    calibrationUploaded: boolean;
    sensorDataUploaded: boolean;
    sensorSamplesCount: number;
    fsrDataUploaded: boolean;
    fsrFramesCount: number;
    painNotesUploaded: boolean;
    painNoteCount: number;
    videoUploaded: boolean;
  };
}

export interface SyncOptions {
  /** Optional metadata to include with the session */
  metadata?: SessionMetadata;
  /** Callback for progress updates */
  onProgress?: (progress: SyncProgress) => void;
  /** Whether to upload video (default: true) */
  includeVideo?: boolean;
  /** Planned session duration in minutes */
  plannedDuration?: number;
  /** Where recording was started from */
  recordingStartedBy?: 'phone' | 'watch';
  /** Pre-session calibration data from wizard */
  calibrationData?: CalibrationData;
  /** Post-session calibration data from wizard */
  postCalibrationData?: CalibrationData;
}

/**
 * Check if the backend is available
 */
export async function isBackendAvailable(): Promise<boolean> {
  return checkHealth();
}

/**
 * Sync a recording session to the backend
 *
 * @param localSession - The local recording session result
 * @param options - Sync options including metadata and progress callback
 * @returns SyncResult with success status and backend session ID
 */
export async function syncSession(
  localSession: RecordingSessionResult,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const {
    metadata,
    onProgress,
    includeVideo = true,
    plannedDuration,
    recordingStartedBy,
    calibrationData,
    postCalibrationData,
  } = options;

  const progress: SyncProgress = {
    status: 'idle',
    step: 'idle',
    progress: 0,
    message: 'Starting sync...',
  };

  const updateProgress = (updates: Partial<SyncProgress>) => {
    Object.assign(progress, updates);
    onProgress?.(progress);
  };

  const result: SyncResult = {
    success: false,
    details: {
      sessionCreated: false,
      calibrationUploaded: false,
      sensorDataUploaded: false,
      sensorSamplesCount: 0,
      fsrDataUploaded: false,
      fsrFramesCount: 0,
      painNotesUploaded: false,
      painNoteCount: 0,
      videoUploaded: false,
    },
  };

  try {
    // Step 1: Check backend availability
    updateProgress({
      status: 'checking',
      step: 'creating_session',
      progress: 5,
      message: 'Checking backend connection...',
    });

    const available = await isBackendAvailable();
    if (!available) {
      throw new Error('Backend is not available. Please check your connection.');
    }

    // Step 2: Create session on backend
    updateProgress({
      status: 'syncing',
      step: 'creating_session',
      progress: 10,
      message: 'Creating session on server...',
    });

    const backendSession = await createSession({
      started_at: new Date(localSession.startTime).toISOString(),
      session_metadata: metadata ? {
        ...metadata,
        local_session_id: localSession.sessionId,
      } : {
        local_session_id: localSession.sessionId,
      },
      planned_duration: plannedDuration,
      recording_started_by: recordingStartedBy,
    });

    result.backendSessionId = backendSession.id;
    result.details!.sessionCreated = true;

    console.log(`[SyncService] Created backend session: ${backendSession.id}`);

    // Step 2.5: Upload calibration data if available
    if (calibrationData) {
      updateProgress({
        step: 'uploading_calibration',
        progress: 15,
        message: 'Uploading calibration data...',
      });

      try {
        const calibrationRequest: CalibrationUploadRequest = {
          max_force: calibrationData.maxForce,
          timestamp: new Date(calibrationData.timestamp).toISOString(),
          duration_ms: calibrationData.durationMs,
          samples: calibrationData.samples?.map(s => ({
            timestamp: s.timestamp,
            force: s.force,
            accel_x: s.accel?.x,
            accel_y: s.accel?.y,
            accel_z: s.accel?.z,
            gyro_x: s.gyro?.x,
            gyro_y: s.gyro?.y,
            gyro_z: s.gyro?.z,
          })),
        };

        await uploadCalibration(backendSession.id, calibrationRequest);
        result.details!.calibrationUploaded = true;
        console.log(`[SyncService] Calibration data uploaded`);
      } catch (calibrationError) {
        // Calibration upload failure is non-fatal - log and continue
        console.warn('[SyncService] Calibration upload failed:', calibrationError);
        updateProgress({
          message: 'Calibration upload failed, continuing...',
        });
      }
    }

    // Step 2.6: Upload post-calibration data if available
    if (postCalibrationData) {
      updateProgress({
        step: 'uploading_calibration',
        progress: 17,
        message: 'Uploading post-calibration data...',
      });

      try {
        const postCalibrationRequest: CalibrationUploadRequest = {
          max_force: postCalibrationData.maxForce,
          timestamp: new Date(postCalibrationData.timestamp).toISOString(),
          duration_ms: postCalibrationData.durationMs,
          is_post_session: true, // Flag to indicate this is post-session calibration
          samples: postCalibrationData.samples?.map(s => ({
            timestamp: s.timestamp,
            force: s.force,
            accel_x: s.accel?.x,
            accel_y: s.accel?.y,
            accel_z: s.accel?.z,
            gyro_x: s.gyro?.x,
            gyro_y: s.gyro?.y,
            gyro_z: s.gyro?.z,
          })),
        };

        await uploadCalibration(backendSession.id, postCalibrationRequest);
        console.log(`[SyncService] Post-calibration data uploaded`);
      } catch (postCalibrationError) {
        // Post-calibration upload failure is non-fatal - log and continue
        console.warn('[SyncService] Post-calibration upload failed:', postCalibrationError);
        updateProgress({
          message: 'Post-calibration upload failed, continuing...',
        });
      }
    }

    // Step 3: Upload sensor data (Watch + Arduino IMU)
    updateProgress({
      step: 'uploading_sensor_data',
      progress: 20,
      message: `Uploading ${localSession.sensorSamples.length} Watch + ${localSession.arduinoSamples.length} Arduino IMU samples...`,
    });

    const totalImuSamples = localSession.sensorSamples.length + localSession.arduinoSamples.length;
    if (totalImuSamples > 0) {
      // Combine Watch and Arduino IMU samples for upload
      const watchApiSamples = convertSensorSamplesToApi(
        localSession.sensorSamples,
        localSession.startTime
      );
      const arduinoApiSamples = localSession.arduinoSamples.map((sample) =>
        convertToApiFormat(
          {
            t: sample.t,
            source: 'arduino',
            accel: sample.accel,
            gyro: sample.gyro,
            orientation: sample.orientation,
          },
          localSession.startTime
        )
      );
      const allApiSamples = [...watchApiSamples, ...arduinoApiSamples];

      // Upload in batches to avoid large payloads
      const BATCH_SIZE = 500;
      let uploadedCount = 0;

      for (let i = 0; i < allApiSamples.length; i += BATCH_SIZE) {
        const batch = allApiSamples.slice(i, i + BATCH_SIZE);
        await uploadSensorData(backendSession.id, { samples: batch });
        uploadedCount += batch.length;

        const progressPercent = 20 + Math.floor((uploadedCount / allApiSamples.length) * 20);
        updateProgress({
          progress: progressPercent,
          message: `Uploaded ${uploadedCount}/${allApiSamples.length} IMU samples...`,
        });
      }

      result.details!.sensorDataUploaded = true;
      result.details!.sensorSamplesCount = uploadedCount;
      console.log(`[SyncService] Uploaded ${uploadedCount} IMU samples`);
    }

    // Step 4: Upload FSR data
    if (localSession.fsrSamples.length > 0) {
      updateProgress({
        step: 'uploading_fsr_data',
        progress: 45,
        message: `Uploading ${localSession.fsrSamples.length} FSR frames...`,
      });

      const fsrApiSamples = localSession.fsrSamples.map(convertFSRToApiFormat);

      // Upload in batches
      const FSR_BATCH_SIZE = 200; // Smaller batches due to larger payload per sample
      let uploadedFsrCount = 0;

      for (let i = 0; i < fsrApiSamples.length; i += FSR_BATCH_SIZE) {
        const batch = fsrApiSamples.slice(i, i + FSR_BATCH_SIZE);
        await uploadFSRData(backendSession.id, { samples: batch });
        uploadedFsrCount += batch.length;

        const progressPercent = 45 + Math.floor((uploadedFsrCount / fsrApiSamples.length) * 15);
        updateProgress({
          progress: progressPercent,
          message: `Uploaded ${uploadedFsrCount}/${fsrApiSamples.length} FSR frames...`,
        });
      }

      result.details!.fsrDataUploaded = true;
      result.details!.fsrFramesCount = uploadedFsrCount;
      console.log(`[SyncService] Uploaded ${uploadedFsrCount} FSR frames`);
    }

    // Step 5: Upload pain notes (if available)
    if (localSession.painNotes.length > 0) {
      updateProgress({
        step: 'uploading_pain_notes',
        progress: 60,
        message: `Uploading ${localSession.painNotes.length} pain notes...`,
      });

      try {
        const painNoteApiSamples = localSession.painNotes.map(convertPainNoteToApiFormat);

        await uploadPainNotes(backendSession.id, { pain_notes: painNoteApiSamples });

        result.details!.painNotesUploaded = true;
        result.details!.painNoteCount = localSession.painNotes.length;
        console.log(`[SyncService] Uploaded ${localSession.painNotes.length} pain notes`);
      } catch (painNoteError) {
        // Pain notes upload failure is non-fatal - log and continue
        console.warn('[SyncService] Pain notes upload failed:', painNoteError);
        updateProgress({
          message: 'Pain notes upload failed, continuing...',
        });
      }
    }

    // Step 6: Upload video (if available and requested)
    console.log(`[SyncService] Video check - includeVideo: ${includeVideo}, videoPath: "${localSession.videoPath || 'null/undefined'}"`);
    if (includeVideo && localSession.videoPath) {
      updateProgress({
        step: 'uploading_video',
        progress: 65,
        message: 'Uploading video...',
      });

      try {
        await uploadVideo(backendSession.id, localSession.videoPath);
        result.details!.videoUploaded = true;
        console.log(`[SyncService] Video uploaded successfully`);
      } catch (videoError) {
        // Video upload failure is non-fatal - log and continue
        console.warn('[SyncService] Video upload failed:', videoError);
        updateProgress({
          message: 'Video upload failed, continuing...',
        });
      }
    } else {
      console.log(`[SyncService] Skipping video upload - includeVideo: ${includeVideo}, videoPath: "${localSession.videoPath || 'null/undefined'}"`);
    }

    // Step 7: Finalize session
    updateProgress({
      step: 'finalizing',
      progress: 90,
      message: 'Finalizing session...',
    });

    await updateSession(backendSession.id, {
      ended_at: new Date(localSession.endTime).toISOString(),
      duration: localSession.duration / 1000, // Convert to seconds
      status: 'completed',
    });

    // Done!
    updateProgress({
      status: 'success',
      step: 'done',
      progress: 100,
      message: 'Sync completed successfully!',
    });

    result.success = true;
    console.log(`[SyncService] Sync completed for session ${backendSession.id}`);

  } catch (error) {
    const errorMessage = error instanceof ApiClientError
      ? `${error.message}: ${error.detail}`
      : error instanceof Error
        ? error.message
        : 'Unknown error occurred';

    console.error('[SyncService] Sync failed:', error);

    updateProgress({
      status: 'error',
      progress: progress.progress,
      message: 'Sync failed',
      error: errorMessage,
    });

    result.error = errorMessage;
  }

  return result;
}

/**
 * Convert local sensor samples to API format
 */
function convertSensorSamplesToApi(
  samples: SensorSample[],
  sessionStartTime: number
): SensorSampleCreate[] {
  return samples.map(sample => convertToApiFormat(
    {
      t: sample.t,
      source: 'watch', // Currently only watch data
      accel: sample.accel,
      gyro: sample.gyro,
      orientation: sample.orientation,
    },
    sessionStartTime
  ));
}

/**
 * Sync multiple sessions (for batch sync)
 */
export async function syncMultipleSessions(
  sessions: RecordingSessionResult[],
  options: Omit<SyncOptions, 'onProgress'> & {
    onSessionProgress?: (sessionIndex: number, progress: SyncProgress) => void;
    onOverallProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<Map<string, SyncResult>> {
  const results = new Map<string, SyncResult>();
  const { onSessionProgress, onOverallProgress, ...syncOptions } = options;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    onOverallProgress?.(i, sessions.length);

    const result = await syncSession(session, {
      ...syncOptions,
      onProgress: (progress) => onSessionProgress?.(i, progress),
    });

    results.set(session.sessionId, result);
  }

  onOverallProgress?.(sessions.length, sessions.length);
  return results;
}
