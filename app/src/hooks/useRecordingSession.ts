/**
 * React hook for orchestrating synchronized video and Watch motion recording
 *
 * This hook combines video recording and Watch motion data collection into a
 * single recording session with synchronized timestamps.
 *
 * Usage:
 * ```tsx
 * const {
 *   sessionId,
 *   isRecording,
 *   startTime,
 *   duration,
 *   videoStatus,
 *   watchStatus,
 *   error,
 *   startRecording,
 *   stopRecording,
 *   getSensorData
 * } = useRecordingSession();
 *
 * // Start synchronized recording
 * await startRecording();
 *
 * // Stop and get results
 * const result = await stopRecording();
 * console.log('Session:', result.sessionId);
 * console.log('Video:', result.videoPath);
 * console.log('Sensor samples:', result.sensorSamples.length);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { v4 as uuidv4 } from 'uuid';
import VideoRecording from '../plugins/VideoRecording';
import { SensorSample, FSRSample, PainNote } from '../types/session';
import {
  ARDUINO_BLE_SERVICE_UUID,
  ARDUINO_SENSOR_DATA_CHAR_UUID,
  ARDUINO_CONTROL_CHAR_UUID,
  ArduinoCommand,
  ArduinoFSRFrame,
  PacketType,
} from '../types/arduino';
import {
  parseIMUPacket,
  encodeCommand,
  toSensorSample,
  getPacketType,
  parseFSRChunk,
  FSRFrameAssembler,
} from '../services/arduinoParser';

// Pain note data received from Watch
interface PainNoteData {
  id: string;
  relativeTimeMs: number;
  text: string;
  painLevel: number;
  timestamp: number; // iOS timestamp when received
}

// Recording control data from Watch
interface RecordingControlData {
  action: 'START' | 'STOP';
  timestamp: number;
}

// Extend the WatchMotionPlugin interface for recording control
interface WatchMotionPlugin {
  isWatchConnected(): Promise<{ connected: boolean }>;
  startWatchRecording(options: { sessionId: string; plannedDuration?: number }): Promise<{ success: boolean; error?: string }>;
  stopWatchRecording(): Promise<{ success: boolean; error?: string }>;
  resetMotionBatchTracking(): Promise<{ success: boolean }>;
  getMotionBatchStats(): Promise<{
    totalSamplesReceived: number;
    expectedSequence: number;
    gapsDetected: number;
    recoveryRequestsSent: number;
  }>;
  addListener(
    eventName: 'motionData',
    callback: (data: MotionData) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'motionBatch',
    callback: (data: MotionBatchData) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'painNote',
    callback: (data: PainNoteData) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'recordingControl',
    callback: (data: RecordingControlData) => void
  ): Promise<{ remove: () => void }>;
}

interface MotionData {
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  orientation: { roll: number; pitch: number; yaw: number };
  timestamp?: number; // Relative timestamp in ms from Watch (if provided)
}

// Motion batch data received from Watch (100Hz binary streaming)
interface MotionBatchSample {
  sequence: number;
  relativeTimeMs: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  orientation: { roll: number; pitch: number; yaw: number };
}

interface MotionBatchData {
  samples: MotionBatchSample[];
  sessionId: string;
  timestamp: number;
}

const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

export type VideoStatus = 'idle' | 'recording' | 'error';
export type WatchStatus = 'idle' | 'recording' | 'error' | 'disconnected';
export type ArduinoStatus = 'idle' | 'recording' | 'error' | 'disconnected';

export interface RecordingSessionState {
  sessionId: string | null;
  isRecording: boolean;
  startTime: number | null; // Unix timestamp ms
  duration: number; // ms since start
  videoStatus: VideoStatus;
  watchStatus: WatchStatus;
  arduinoStatus: ArduinoStatus;
  error: string | null;
}

export interface RecordingSessionResult {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  videoPath: string | null;
  sensorSamples: SensorSample[];       // Watch data
  arduinoSamples: SensorSample[];      // Arduino/racket IMU data
  fsrSamples: FSRSample[];             // FSR pressure grid data
  painNotes: PainNote[];               // Voice-recorded pain notes from Watch
}

export interface UseRecordingSessionResult extends RecordingSessionState {
  /**
   * Start synchronized recording session
   * @param arduinoDeviceId - Optional BLE device ID of connected Arduino
   * @param externalSessionId - Optional external session ID (e.g., from wizard) to ensure all components use the same ID
   * @param plannedDuration - Optional planned duration in minutes (for Watch time remaining notifications)
   * @param stateMachineHandlesVideo - If true, skip video start/stop (state machine handles it)
   */
  startRecording: (arduinoDeviceId?: string, externalSessionId?: string, plannedDuration?: number, stateMachineHandlesVideo?: boolean) => Promise<void>;
  /**
   * Stop recording and return results
   * @param videoPathOverride - Optional video path from state machine (used when state machine handles video)
   */
  stopRecording: (videoPathOverride?: string) => Promise<RecordingSessionResult | null>;
  getSensorData: () => { watch: SensorSample[]; arduino: SensorSample[] };
}

export function useRecordingSession(): UseRecordingSessionResult {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [videoStatus, setVideoStatus] = useState<VideoStatus>('idle');
  const [watchStatus, setWatchStatus] = useState<WatchStatus>('idle');
  const [arduinoStatus, setArduinoStatus] = useState<ArduinoStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Sensor data collection (Watch)
  const sensorSamplesRef = useRef<SensorSample[]>([]);
  const motionListenerRef = useRef<{ remove: () => void } | null>(null);
  const motionBatchListenerRef = useRef<{ remove: () => void } | null>(null);

  // Pain notes collection (Watch voice notes)
  const painNotesRef = useRef<PainNote[]>([]);
  const painNoteListenerRef = useRef<{ remove: () => void } | null>(null);

  // NOTE: Recording control from Watch is handled in RecordingWizardPage.tsx
  // These refs are kept for potential future use but the listener is not set up here
  const stopRecordingRef = useRef<(() => Promise<RecordingSessionResult | null>) | null>(null);

  // Guard against multiple simultaneous stop calls
  const isStoppingRef = useRef(false);
  const stopResultRef = useRef<RecordingSessionResult | null>(null);

  // Arduino data collection
  const arduinoSamplesRef = useRef<SensorSample[]>([]);
  const arduinoDeviceIdRef = useRef<string | null>(null);
  const arduinoStartTimeRef = useRef<number>(0);

  // FSR data collection
  const fsrSamplesRef = useRef<FSRSample[]>([]);
  const fsrAssemblerRef = useRef<FSRFrameAssembler>(new FSRFrameAssembler());

  // Track if state machine handles video (for skipping video stop)
  const stateMachineHandlesVideoRef = useRef(false);

  // Video recording state (managed directly via native plugin, not via useVideoRecording hook)
  const isVideoRecordingRef = useRef(false);
  const videoPathRef = useRef<string | null>(null);

  // Track when recording is fully initialized (for minimum duration check)
  // Video needs ~2-3 seconds to have valid data, so we enforce minimum recording time
  const recordingReadyTimeRef = useRef<number>(0);
  const MINIMUM_RECORDING_MS = 3000; // 3 seconds minimum for valid video

  const isNative = Capacitor.isNativePlatform();

  // Update duration while recording
  useEffect(() => {
    if (!isRecording || !startTime) return;

    const interval = setInterval(() => {
      setDuration(Date.now() - startTime);
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  // Video status is now managed directly in startRecording/stopRecording

  // NOTE: External stop from Watch is handled in RecordingWizardPage.tsx
  // The page's recordingControl listener calls wizard.stopRecording() which
  // triggers the effect that calls handleExternalStop() → recordingSession.stopRecording()

  // Check Watch connection status periodically
  useEffect(() => {
    if (!isNative || !isRecording) return;

    const checkConnection = async () => {
      try {
        const result = await WatchMotion.isWatchConnected();
        if (!result.connected && watchStatus !== 'disconnected') {
          setWatchStatus('disconnected');
          console.warn('Watch disconnected during recording');
        } else if (result.connected && watchStatus === 'disconnected') {
          setWatchStatus('recording');
        }
      } catch (err) {
        console.error('Error checking Watch connection:', err);
      }
    };

    const interval = setInterval(checkConnection, 2000); // Check every 2s
    return () => clearInterval(interval);
  }, [isNative, isRecording, watchStatus]);

  /**
   * Start synchronized recording session
   * @param arduinoDeviceId - Optional BLE device ID of connected Arduino
   * @param externalSessionId - Optional external session ID (e.g., from wizard) to ensure consistency
   * @param plannedDuration - Optional planned duration in minutes (for Watch time remaining notifications)
   * @param stateMachineHandlesVideo - If true, skip video start (state machine handles it)
   */
  const startRecording = useCallback(async (arduinoDeviceId?: string, externalSessionId?: string, plannedDuration?: number, stateMachineHandlesVideo?: boolean): Promise<void> => {
    if (isRecording) {
      throw new Error('Recording already in progress');
    }

    if (!isNative) {
      throw new Error('Recording is only available on native iOS');
    }

    // Use external session ID if provided, otherwise generate new one
    // This ensures all components (Watch, video, sensors) use the same session ID
    const newSessionId = externalSessionId || uuidv4();
    console.log('🎬🎬🎬 ============ STARTING RECORDING SESSION ============');
    console.log('🎬 Session ID:', newSessionId);
    console.log('🎬 External ID provided:', externalSessionId || 'none');
    console.log('🎬 Arduino device ID:', arduinoDeviceId || 'none');
    console.log('🎬 Planned duration:', plannedDuration, 'minutes');

    // Reset state
    setSessionId(newSessionId);
    setError(null);
    sensorSamplesRef.current = [];
    arduinoSamplesRef.current = [];
    fsrSamplesRef.current = [];
    painNotesRef.current = [];
    fsrAssemblerRef.current.clear();
    arduinoDeviceIdRef.current = arduinoDeviceId || null;
    // Clear stop guards from previous session
    isStoppingRef.current = false;
    stopResultRef.current = null;
    const recordingStartTime = Date.now();
    arduinoStartTimeRef.current = recordingStartTime;
    setStartTime(recordingStartTime);

    // ============================================================
    // STEP 0 & 1: Video recording
    // Skip if state machine handles video orchestration
    // ============================================================
    stateMachineHandlesVideoRef.current = stateMachineHandlesVideo ?? false;

    if (stateMachineHandlesVideo) {
      console.log('🎥 [STEP 0-1/4] Skipping video start - state machine handles video orchestration');
      // State machine already started video, just mark as recording
      isVideoRecordingRef.current = true;
      setVideoStatus('recording');
    } else {
      // Legacy path: useRecordingSession handles video
      try {
        console.log('🎥 [STEP 0/4] Resetting any stale recording state...');
        await VideoRecording.resetRecordingState();
        console.log('✅ Recording state reset');
      } catch (err) {
        console.warn('⚠️ Failed to reset recording state (non-fatal):', err);
      }

      try {
        console.log('🎥 [STEP 1/4] Starting video recording FIRST (takes longest)...');
        console.log('🎥 Session ID:', newSessionId);
        await VideoRecording.startRecording({ sessionId: newSessionId });
        isVideoRecordingRef.current = true;
        console.log('🎥 isVideoRecordingRef.current SET TO TRUE');
        setVideoStatus('recording');
        console.log('✅ Video recording started successfully');
      } catch (err) {
        // Video failed - this is critical, abort the entire recording
        setVideoStatus('error');
        isVideoRecordingRef.current = false;
        console.log('🎥❌ isVideoRecordingRef.current SET TO FALSE (video start failed)');
        const errorMsg = err instanceof Error ? err.message : 'Failed to start video recording';
        setError(errorMsg);
        console.error('❌❌❌ Video recording failed to start:', err);
        console.error('❌ Aborting recording - video is required');
        throw err; // Re-throw to abort
      }
    }

    // Now that video is recording, set isRecording to true
    setIsRecording(true);

    // ============================================================
    // STEP 2: Setup Watch listeners and start Watch recording
    // ============================================================
    console.log('📡 [STEP 2/4] Setting up Watch listeners and starting recording...');

    // Skip Watch start command if state machine handles orchestration
    // The state machine will send START command via WatchConnectivityManager
    if (!stateMachineHandlesVideo) {
      // Legacy path: useRecordingSession handles Watch start
      // First, stop any existing Watch recording to ensure clean state
      try {
        console.log('📡 Stopping any existing Watch recording (cleanup)...');
        await WatchMotion.stopWatchRecording();
        console.log('📡 Watch recording cleanup complete');
      } catch (err) {
        // This is expected to fail if no recording was in progress - ignore
        console.log('📡 No existing Watch recording to stop (expected)');
      }
    } else {
      console.log('📡 Skipping Watch cleanup - state machine handles orchestration');
    }

    // Reset motion batch tracking for new recording
    try {
      await WatchMotion.resetMotionBatchTracking();
      console.log('📡 Motion batch tracking reset');
    } catch (err) {
      console.warn('Failed to reset motion batch tracking:', err);
    }

    // Setup motion batch listener (100Hz binary streaming)
    try {
      const batchListener = await WatchMotion.addListener('motionBatch', (data: MotionBatchData) => {
        // Process each sample in the batch
        for (const batchSample of data.samples) {
          const sample: SensorSample = {
            t: batchSample.relativeTimeMs,
            accel: {
              x: batchSample.accel.x,
              y: batchSample.accel.y,
              z: batchSample.accel.z,
            },
            gyro: {
              x: batchSample.gyro.x,
              y: batchSample.gyro.y,
              z: batchSample.gyro.z,
            },
            orientation: {
              roll: batchSample.orientation.roll,
              pitch: batchSample.orientation.pitch,
              yaw: batchSample.orientation.yaw,
            },
            sequence: batchSample.sequence,
          };

          sensorSamplesRef.current.push(sample);
        }

        // Log progress every 1000 samples (10 seconds at 100Hz)
        if (sensorSamplesRef.current.length % 1000 < data.samples.length) {
          console.log(`📊 Watch samples: ${sensorSamplesRef.current.length}`);
        }
      });

      motionBatchListenerRef.current = batchListener;
      console.log('✅ Motion batch listener registered (100Hz binary streaming)');
    } catch (err) {
      console.error('Failed to setup motion batch listener:', err);
      // Fallback to legacy motion data listener
      console.log('📡 Falling back to legacy motion data listener...');
    }

    // Also setup legacy motion data listener as fallback
    try {
      const listener = await WatchMotion.addListener('motionData', (data: MotionData) => {
        // Only process if batch listener isn't active
        if (motionBatchListenerRef.current) {
          return; // Batch listener is handling data
        }

        const now = Date.now();
        const relativeTime = now - recordingStartTime;

        const sample: SensorSample = {
          t: relativeTime,
          accel: {
            x: data.accel.x,
            y: data.accel.y,
            z: data.accel.z,
          },
          gyro: {
            x: data.gyro.x,
            y: data.gyro.y,
            z: data.gyro.z,
          },
          orientation: {
            roll: data.orientation.roll,
            pitch: data.orientation.pitch,
            yaw: data.orientation.yaw,
          },
        };

        sensorSamplesRef.current.push(sample);
      });

      motionListenerRef.current = listener;
      console.log('✅ Legacy motion data listener registered');
    } catch (err) {
      console.error('Failed to setup motion listener:', err);
      setWatchStatus('error');
      const errorMsg = err instanceof Error ? err.message : 'Failed to setup motion listener';
      setError(errorMsg);
      // Don't throw - we can still record video without Watch data
    }

    // Setup pain note listener
    try {
      const painListener = await WatchMotion.addListener('painNote', (data: PainNoteData) => {
        const painNote: PainNote = {
          id: data.id,
          timestamp: data.relativeTimeMs,
          text: data.text,
          painLevel: data.painLevel,
        };

        painNotesRef.current.push(painNote);
        console.log(`📝 Collected pain note #${painNotesRef.current.length}: "${data.text}" (level ${data.painLevel})`);
      });

      painNoteListenerRef.current = painListener;
      console.log('✅ Pain note listener registered');
    } catch (err) {
      console.error('Failed to setup pain note listener:', err);
      // Don't throw - pain notes are optional
    }

    // NOTE: Recording control listener is handled in RecordingWizardPage.tsx
    // Do NOT add another listener here - it causes double-stop issues

    // Start Watch recording
    // Skip if state machine handles orchestration - it sends START via WatchConnectivityManager
    if (stateMachineHandlesVideo) {
      console.log('🎬 Skipping Watch start command - state machine handles orchestration');
      setWatchStatus('recording'); // Assume state machine started Watch successfully
    } else {
      // Legacy path: useRecordingSession handles Watch start
      try {
        console.log('🎬 Starting Watch recording...', { sessionId: newSessionId, plannedDuration });
        const watchResult = await WatchMotion.startWatchRecording({
          sessionId: newSessionId,
          plannedDuration: plannedDuration,
        });

        if (watchResult.success) {
          setWatchStatus('recording');
          console.log('✅ Watch recording started');
        } else {
          setWatchStatus('error');
          const errorMsg = watchResult.error || 'Failed to start Watch recording';
          setError(errorMsg);
          console.error('❌ Watch recording failed:', errorMsg);
          // Don't throw - we can still record video
        }
      } catch (err) {
        setWatchStatus('error');
        const errorMsg = err instanceof Error ? err.message : 'Failed to start Watch recording';
        setError(errorMsg);
        console.error('❌ Watch recording error:', err);
        // Don't throw - we can still record video
      }
    }

    // ============================================================
    // STEP 3: Start Arduino/racket sensor streaming (IMU + FSR)
    // ============================================================
    console.log('🎾 [STEP 3/4] Starting Arduino sensor streaming...');

    if (arduinoDeviceId) {
      try {
        // Start BLE notifications for combined sensor data
        await BleClient.startNotifications(
          arduinoDeviceId,
          ARDUINO_BLE_SERVICE_UUID,
          ARDUINO_SENSOR_DATA_CHAR_UUID,
          (value: DataView) => {
            const packetType = getPacketType(value);

            // Handle IMU packet
            if (packetType === PacketType.IMU) {
              const sample = parseIMUPacket(value);
              if (!sample) return;

              // Convert to SensorSample format
              const sensorSample = toSensorSample(sample, recordingStartTime);
              arduinoSamplesRef.current.push(sensorSample);

              // Log every 100 samples
              if (arduinoSamplesRef.current.length % 100 === 0) {
                console.log(`🎾 Arduino IMU samples: ${arduinoSamplesRef.current.length}`);
              }
              return;
            }

            // Handle FSR packet
            if (packetType === PacketType.FSR) {
              const chunk = parseFSRChunk(value);
              if (!chunk) return;

              // Assemble frame from chunks
              const frame = fsrAssemblerRef.current.addChunk(chunk);
              if (frame) {
                // Convert to FSRSample for storage
                const fsrSample: FSRSample = {
                  t: frame.timestamp - recordingStartTime,
                  seq: frame.frameSequence,
                  values: frame.flat,
                };
                fsrSamplesRef.current.push(fsrSample);

                // Log every 100 frames
                if (fsrSamplesRef.current.length % 100 === 0) {
                  console.log(`🎾 FSR frames: ${fsrSamplesRef.current.length}`);
                }
              }
              return;
            }

            // Try legacy IMU format (no type header)
            const sample = parseIMUPacket(value);
            if (sample) {
              const sensorSample = toSensorSample(sample, recordingStartTime);
              arduinoSamplesRef.current.push(sensorSample);
            }
          }
        );

        // Send START_ALL command to Arduino (starts both IMU and FSR)
        const startCmd = encodeCommand(ArduinoCommand.START_ALL);
        await BleClient.write(
          arduinoDeviceId,
          ARDUINO_BLE_SERVICE_UUID,
          ARDUINO_CONTROL_CHAR_UUID,
          startCmd
        );

        setArduinoStatus('recording');
        console.log('✅ Arduino sensor streaming started (IMU + FSR)');
      } catch (err) {
        setArduinoStatus('error');
        const errorMsg = err instanceof Error ? err.message : 'Failed to start Arduino streaming';
        console.error('❌ Arduino streaming error:', err);
        // Don't throw - we can still record without Arduino data
      }
    } else {
      setArduinoStatus('idle');
      console.log('ℹ️ No Arduino device connected, skipping racket data');
    }

    // ============================================================
    // STEP 4: Recording fully started - log completion
    // ============================================================
    const initDuration = Date.now() - recordingStartTime;
    console.log(`🎬🎬🎬 ============ RECORDING SESSION STARTED ============`);
    console.log(`🎬 Initialization took ${initDuration}ms`);
    console.log(`🎬 Video: ✅ | Watch: ${watchStatus === 'recording' ? '✅' : '⚠️'} | Arduino: ${arduinoDeviceId ? (arduinoStatus === 'recording' ? '✅' : '⚠️') : 'N/A'}`);

    // Record when initialization completed (for minimum duration check)
    recordingReadyTimeRef.current = Date.now();
  }, [isRecording, isNative, watchStatus]);

  /**
   * Stop recording and return session data
   * @param videoPathOverride - Optional video path from state machine (used when state machine handles video)
   */
  const stopRecording = useCallback(async (videoPathOverride?: string): Promise<RecordingSessionResult | null> => {
    // Guard against multiple simultaneous stop calls
    if (isStoppingRef.current) {
      console.warn('🛑 Stop already in progress, waiting for result...');
      // Wait a bit and return the cached result if available
      await new Promise(resolve => setTimeout(resolve, 100));
      return stopResultRef.current;
    }

    if (!isRecording || !sessionId || !startTime) {
      console.warn('No recording in progress');
      return stopResultRef.current; // Return cached result if available
    }

    isStoppingRef.current = true;
    console.log('🛑🛑🛑 ============ STOPPING RECORDING SESSION ============');
    console.log('🛑 Session ID:', sessionId);
    console.log('🛑 isVideoRecordingRef.current:', isVideoRecordingRef.current);
    console.log('🛑 arduinoDeviceIdRef.current:', arduinoDeviceIdRef.current || 'none');

    // Check minimum recording duration
    // Video needs at least 3 seconds of recording for AVFoundation to write valid data
    if (recordingReadyTimeRef.current > 0) {
      const elapsedSinceReady = Date.now() - recordingReadyTimeRef.current;
      if (elapsedSinceReady < MINIMUM_RECORDING_MS) {
        const waitTime = MINIMUM_RECORDING_MS - elapsedSinceReady;
        console.log(`⏳ Recording only ${elapsedSinceReady}ms, waiting ${waitTime}ms for minimum duration...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        console.log('✅ Minimum duration reached, proceeding with stop');
      }
    }

    const endTime = Date.now();
    const sessionDuration = endTime - startTime;
    console.log('🛑 Duration:', sessionDuration, 'ms');

    let videoPath: string | null = null;
    const errors: string[] = [];

    // Stop video recording
    if (stateMachineHandlesVideoRef.current) {
      // State machine handles video - use the override path
      console.log('🎥 State machine handles video - skipping video stop');
      if (videoPathOverride) {
        videoPath = videoPathOverride;
        videoPathRef.current = videoPath;
        console.log('✅ Using video path from state machine:', videoPath);
      } else {
        console.warn('🎥⚠️ State machine handles video but no videoPathOverride provided');
      }
      isVideoRecordingRef.current = false;
      setVideoStatus('idle');
    } else if (isVideoRecordingRef.current) {
      // Legacy path: useRecordingSession handles video
      try {
        console.log('🎥 Stopping video recording via native plugin...');
        const videoResult = await VideoRecording.stopRecording();
        console.log('🎥 VideoRecording.stopRecording() returned:', videoResult);
        if (videoResult) {
          videoPath = videoResult.videoPath;
          videoPathRef.current = videoPath;
          console.log('✅ Video saved at:', videoPath);
        }
        isVideoRecordingRef.current = false;
        setVideoStatus('idle');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to stop video recording';
        errors.push(errorMsg);
        console.error('❌ Video stop error:', err);
        isVideoRecordingRef.current = false;
        setVideoStatus('error');
      }
    } else {
      console.warn('🎥⚠️ Video recording was NOT active (isVideoRecordingRef.current was false), skipping video stop!');
      console.warn('🎥⚠️ This means video recording either never started or was already stopped');
    }

    // Stop Watch recording
    // Skip if state machine handles orchestration - it sends STOP via WatchConnectivityManager
    if (stateMachineHandlesVideoRef.current) {
      console.log('🛑 Skipping Watch stop command - state machine handles orchestration');
    } else {
      // Legacy path: useRecordingSession handles Watch stop
      try {
        console.log('🛑 Stopping Watch recording...');
        const watchResult = await WatchMotion.stopWatchRecording();
        if (watchResult.success) {
          console.log('✅ Watch recording stopped');
        } else {
          const errorMsg = watchResult.error || 'Failed to stop Watch recording';
          errors.push(errorMsg);
          console.error('❌ Watch stop failed:', errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to stop Watch recording';
        errors.push(errorMsg);
        console.error('❌ Watch stop error:', err);
      }
    }

    // Stop Arduino sensor streaming (IMU + FSR)
    if (arduinoDeviceIdRef.current) {
      try {
        console.log('🛑 Stopping Arduino sensor streaming...');

        // Send STOP_ALL command
        const stopCmd = encodeCommand(ArduinoCommand.STOP_ALL);
        await BleClient.write(
          arduinoDeviceIdRef.current,
          ARDUINO_BLE_SERVICE_UUID,
          ARDUINO_CONTROL_CHAR_UUID,
          stopCmd
        );

        // Stop notifications
        await BleClient.stopNotifications(
          arduinoDeviceIdRef.current,
          ARDUINO_BLE_SERVICE_UUID,
          ARDUINO_SENSOR_DATA_CHAR_UUID
        );

        console.log('✅ Arduino sensor streaming stopped');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to stop Arduino streaming';
        errors.push(errorMsg);
        console.error('❌ Arduino stop error:', err);
      }
    }

    // Remove motion listeners
    if (motionBatchListenerRef.current) {
      motionBatchListenerRef.current.remove();
      motionBatchListenerRef.current = null;
      console.log('🧹 Motion batch listener removed');
    }
    if (motionListenerRef.current) {
      motionListenerRef.current.remove();
      motionListenerRef.current = null;
      console.log('🧹 Motion listener removed');
    }

    // Log motion batch stats
    try {
      const stats = await WatchMotion.getMotionBatchStats();
      console.log('📊 Motion batch stats:', stats);
    } catch (err) {
      // Ignore stats errors
    }

    // Remove pain note listener
    if (painNoteListenerRef.current) {
      painNoteListenerRef.current.remove();
      painNoteListenerRef.current = null;
      console.log('🧹 Pain note listener removed');
    }

    // NOTE: Recording control listener is handled in RecordingWizardPage.tsx

    // Get collected sensor data
    const sensorSamples = [...sensorSamplesRef.current];
    const arduinoSamples = [...arduinoSamplesRef.current];
    const fsrSamples = [...fsrSamplesRef.current];
    const painNotes = [...painNotesRef.current];
    console.log(`📊 Collected ${sensorSamples.length} Watch samples, ${arduinoSamples.length} Arduino IMU samples, ${fsrSamples.length} FSR frames, ${painNotes.length} pain notes`);

    // Reset state
    setIsRecording(false);
    setVideoStatus('idle');
    setWatchStatus('idle');
    setArduinoStatus('idle');
    setDuration(0);

    // Set error if any occurred
    if (errors.length > 0) {
      setError(errors.join('; '));
    }

    const result: RecordingSessionResult = {
      sessionId,
      startTime,
      endTime,
      duration: sessionDuration,
      videoPath,
      sensorSamples,
      arduinoSamples,
      fsrSamples,
      painNotes,
    };

    // Clear session after a delay (allow time for UI to read final state)
    setTimeout(() => {
      setSessionId(null);
      setStartTime(null);
      setError(null);
      sensorSamplesRef.current = [];
      arduinoSamplesRef.current = [];
      fsrSamplesRef.current = [];
      painNotesRef.current = [];
      fsrAssemblerRef.current.clear();
      arduinoDeviceIdRef.current = null;
      videoPathRef.current = null;
    }, 1000);

    console.log('✅ Recording session completed:', {
      sessionId,
      duration: sessionDuration,
      videoPath,
      watchSampleCount: sensorSamples.length,
      arduinoSampleCount: arduinoSamples.length,
      fsrFrameCount: fsrSamples.length,
      painNoteCount: painNotes.length,
    });

    // Cache result and clear stopping flag
    stopResultRef.current = result;
    isStoppingRef.current = false;

    return result;
  }, [isRecording, sessionId, startTime]);

  /**
   * Get current sensor data (read-only)
   */
  const getSensorData = useCallback((): { watch: SensorSample[]; arduino: SensorSample[] } => {
    return {
      watch: [...sensorSamplesRef.current],
      arduino: [...arduinoSamplesRef.current],
    };
  }, []);

  // Update stopRecordingRef when stopRecording changes
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (motionBatchListenerRef.current) {
        motionBatchListenerRef.current.remove();
        motionBatchListenerRef.current = null;
      }
      if (motionListenerRef.current) {
        motionListenerRef.current.remove();
        motionListenerRef.current = null;
      }
      if (painNoteListenerRef.current) {
        painNoteListenerRef.current.remove();
        painNoteListenerRef.current = null;
      }
      // NOTE: Recording control listener is handled in RecordingWizardPage.tsx
      // Stop Arduino notifications if active
      if (arduinoDeviceIdRef.current && isNative) {
        BleClient.stopNotifications(
          arduinoDeviceIdRef.current,
          ARDUINO_BLE_SERVICE_UUID,
          ARDUINO_SENSOR_DATA_CHAR_UUID
        ).catch(() => {});
      }
      // Stop video recording if still active (skip if state machine handles it)
      if (isVideoRecordingRef.current && isNative && !stateMachineHandlesVideoRef.current) {
        VideoRecording.stopRecording().catch(() => {});
        isVideoRecordingRef.current = false;
      }
      // Clear FSR assembler
      fsrAssemblerRef.current.clear();
    };
  }, [isNative]);

  return {
    sessionId,
    isRecording,
    startTime,
    duration,
    videoStatus,
    watchStatus,
    arduinoStatus,
    error,
    startRecording,
    stopRecording,
    getSensorData,
  };
}
