/**
 * State machine hook for the Recording Session Wizard
 * Manages wizard flow from device connection through calibration to recording
 *
 * NOTE: Recording state (isRecording, startTime, startedBy) is now managed by
 * the native RecordingStateMachine. This wizard hook handles navigation/calibration only.
 */

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import RecordingStateMachine from '../plugins/RecordingStateMachine';
import {
  WizardState,
  WizardAction,
  WizardStep,
  CalibrationData,
  CalibrationSample,
  RecordingStartedBy,
  createInitialWizardState,
  DEFAULT_DURATION_CONFIG,
  DemoModeState,
} from '../types/recordingWizard';
import {
  ARDUINO_BLE_SERVICE_UUID,
  ARDUINO_SENSOR_DATA_CHAR_UUID,
  ARDUINO_CONTROL_CHAR_UUID,
  ARDUINO_DEVICE_NAME,
  ArduinoDevice,
  ArduinoCommand,
  PacketType,
} from '../types/arduino';
import {
  getPacketType,
  parseFSRChunk,
  FSRFrameAssembler,
} from '../services/arduinoParser';
import type { ArduinoFSRFrame } from '../types/arduino';

// WatchMotion plugin interface
interface WatchMotionPlugin {
  isWatchConnected(): Promise<{ connected: boolean }>;
  startWatchRecording(options: { sessionId: string }): Promise<{ success: boolean; error?: string }>;
  stopWatchRecording(): Promise<{ success: boolean; error?: string }>;
  sendCalibrationCommand(command: {
    type: string;
    countdown?: number;
    progress?: number;
    maxForce?: number;
    message?: string;
    sessionId?: string;
  }): Promise<{ success: boolean; error?: string }>;
  addListener(
    eventName: 'motionData' | 'recordingControl',
    callback: (data: unknown) => void
  ): Promise<{ remove: () => void }>;
}

const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

// Reducer for wizard state
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };

    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.sessionId };

    case 'SET_DEVICE_STATE':
      return {
        ...state,
        devices: {
          ...state.devices,
          [action.device]: { ...state.devices[action.device], ...action.state },
        },
      };

    case 'SET_DEMO_MODE':
      return {
        ...state,
        demoMode: {
          ...state.demoMode,
          racketEnabled: action.racketEnabled,
        },
      };

    case 'SET_DURATION':
      return { ...state, plannedDuration: action.minutes };

    case 'SET_COUNTDOWN':
      return {
        ...state,
        calibration: { ...state.calibration, countdown: action.value },
      };

    case 'SET_SQUEEZE_PROGRESS':
      return {
        ...state,
        calibration: { ...state.calibration, squeezeProgress: action.value },
      };

    case 'START_CALIBRATION_COLLECTION':
      return {
        ...state,
        calibration: {
          ...state.calibration,
          isCollecting: true,
          samples: [],
          maxForce: 0,
        },
      };

    case 'ADD_CALIBRATION_SAMPLE':
      return {
        ...state,
        calibration: {
          ...state.calibration,
          samples: [...state.calibration.samples, action.sample],
        },
      };

    case 'UPDATE_MAX_FORCE':
      return {
        ...state,
        calibration: {
          ...state.calibration,
          maxForce: Math.max(state.calibration.maxForce, action.force),
        },
      };

    case 'FINISH_CALIBRATION':
      return {
        ...state,
        calibration: { ...state.calibration, isCollecting: false },
        calibrationResult: action.result,
      };

    case 'RESET_CALIBRATION':
      return {
        ...state,
        calibration: {
          countdown: 3,
          squeezeProgress: 0,
          isCollecting: false,
          maxForce: 0,
          samples: [],
        },
        calibrationResult: null,
      };

    // Post-calibration actions
    case 'SET_POST_CAL_COUNTDOWN':
      return {
        ...state,
        postCalibration: { ...state.postCalibration, countdown: action.value },
      };

    case 'SET_POST_CAL_SQUEEZE_PROGRESS':
      return {
        ...state,
        postCalibration: { ...state.postCalibration, squeezeProgress: action.value },
      };

    case 'START_POST_CALIBRATION_COLLECTION':
      return {
        ...state,
        postCalibration: {
          ...state.postCalibration,
          isCollecting: true,
          samples: [],
          maxForce: 0,
        },
      };

    case 'ADD_POST_CALIBRATION_SAMPLE':
      return {
        ...state,
        postCalibration: {
          ...state.postCalibration,
          samples: [...state.postCalibration.samples, action.sample],
        },
      };

    case 'UPDATE_POST_CAL_MAX_FORCE':
      return {
        ...state,
        postCalibration: {
          ...state.postCalibration,
          maxForce: Math.max(state.postCalibration.maxForce, action.force),
        },
      };

    case 'FINISH_POST_CALIBRATION':
      return {
        ...state,
        postCalibration: { ...state.postCalibration, isCollecting: false },
        postCalibrationResult: action.result,
      };

    case 'RESET_POST_CALIBRATION':
      return {
        ...state,
        postCalibration: {
          countdown: 3,
          squeezeProgress: 0,
          isCollecting: false,
          maxForce: 0,
          samples: [],
        },
        postCalibrationResult: null,
      };

    case 'SET_CAMERA_READY':
      return {
        ...state,
        camera: { ...state.camera, isReady: action.ready },
      };

    case 'SET_CAMERA_PREVIEW':
      return {
        ...state,
        camera: { ...state.camera, isPreviewActive: action.active },
      };

    case 'SET_CAMERA_ERROR':
      return {
        ...state,
        camera: { ...state.camera, error: action.error },
      };

    case 'ENABLE_WATCH_CONTROL':
      return {
        ...state,
        recording: { ...state.recording, canStartFromWatch: true },
      };

    case 'START_RECORDING':
      return {
        ...state,
        recording: {
          ...state.recording,
          isRecording: true,
          startedBy: action.startedBy,
          startTime: Date.now(),
        },
      };

    case 'STOP_RECORDING':
      return {
        ...state,
        recording: {
          ...state.recording,
          isRecording: false,
        },
      };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'RESET':
      return createInitialWizardState();

    default:
      return state;
  }
}

export interface UseRecordingWizardResult {
  state: WizardState;
  // Navigation
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;
  // Device connection
  startDeviceScan: () => Promise<void>;
  retryDeviceConnection: () => Promise<void>;
  // Demo mode
  setRacketDemoMode: (enabled: boolean) => void;
  // Duration
  setDuration: (minutes: number) => void;
  durationConfig: typeof DEFAULT_DURATION_CONFIG;
  // Calibration
  startCalibrationSequence: () => Promise<void>;
  resetCalibration: () => void;
  // Post-calibration
  startPostCalibrationSequence: () => Promise<void>;
  skipPostCalibration: () => void;
  resetPostCalibration: () => void;
  // Camera
  setCameraReady: (ready: boolean) => void;
  setCameraPreview: (active: boolean) => void;
  // Recording
  startRecording: (startedBy: RecordingStartedBy) => Promise<void>;
  stopRecording: () => Promise<{ videoPath?: string } | null>;
}

export function useRecordingWizard(): UseRecordingWizardResult {
  const [state, dispatch] = useReducer(wizardReducer, createInitialWizardState());
  const isNative = Capacitor.isNativePlatform();

  // Refs for cleanup
  const calibrationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const postCalibrationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingControlListenerRef = useRef<{ remove: () => void } | null>(null);

  // FSR collection for calibration
  const fsrAssemblerRef = useRef<FSRFrameAssembler>(new FSRFrameAssembler());
  const fsrCalibrationSamplesRef = useRef<ArduinoFSRFrame[]>([]);
  const fsrNotificationActiveRef = useRef<boolean>(false);

  // Step navigation mapping
  const stepOrder: WizardStep[] = [
    'finding_devices',
    'devices_connected',
    'duration_picker',
    'calibration_intro',
    'calibration_instructions',
    'calibration_countdown',
    'calibration_squeeze',
    'calibration_done',
    'calibration_complete',
    'camera_setup_intro',
    'camera_instructions',
    'camera_preview',
    'recording_active',
  ];

  // Navigation helpers
  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const goNext = useCallback(() => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex < stepOrder.length - 1) {
      dispatch({ type: 'SET_STEP', step: stepOrder[currentIndex + 1] });
    }
  }, [state.currentStep]);

  const goBack = useCallback(() => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex > 0) {
      dispatch({ type: 'SET_STEP', step: stepOrder[currentIndex - 1] });
    }
  }, [state.currentStep]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Refs for BLE scanning
  const bleInitializedRef = useRef(false);
  const bleScanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const discoveredArduinoRef = useRef<ArduinoDevice | null>(null);

  // Device scanning
  const startDeviceScan = useCallback(async () => {
    dispatch({ type: 'SET_STEP', step: 'finding_devices' });
    dispatch({ type: 'SET_DEVICE_STATE', device: 'watch', state: { isConnecting: true, error: undefined } });
    dispatch({ type: 'SET_DEVICE_STATE', device: 'racket', state: { isConnecting: true, error: undefined } });

    // Generate session ID for this wizard flow
    // This sessionId will be shared with Watch and passed to useRecordingSession
    const sessionId = uuidv4();
    console.log('[useRecordingWizard] Generated session ID for wizard:', sessionId);
    dispatch({ type: 'SET_SESSION_ID', sessionId });

    // Check Watch connection
    if (isNative) {
      try {
        const result = await WatchMotion.isWatchConnected();
        dispatch({
          type: 'SET_DEVICE_STATE',
          device: 'watch',
          state: {
            isConnected: result.connected,
            isConnecting: false,
            name: result.connected ? "Ashley's Apple Watch" : undefined,
          },
        });
      } catch (err) {
        dispatch({
          type: 'SET_DEVICE_STATE',
          device: 'watch',
          state: {
            isConnected: false,
            isConnecting: false,
            error: err instanceof Error ? err.message : 'Failed to check Watch',
          },
        });
      }

      // Initialize BLE and scan for Arduino racket sensor
      try {
        if (!bleInitializedRef.current) {
          await BleClient.initialize({ androidNeverForLocation: true });
          bleInitializedRef.current = true;
        }

        discoveredArduinoRef.current = null;

        // Start BLE scan for Arduino device
        // Note: Not filtering by service UUID because some devices don't advertise services until connected
        console.log('Starting BLE scan for devices with name prefix:', ARDUINO_DEVICE_NAME);
        await BleClient.requestLEScan(
          {
            // Don't filter by service UUID - some BLE peripherals don't advertise services
            // services: [ARDUINO_BLE_SERVICE_UUID],
            namePrefix: ARDUINO_DEVICE_NAME,
          },
          (result) => {
            console.log('Found Arduino device:', result.device.name, result.device.deviceId);
            discoveredArduinoRef.current = {
              deviceId: result.device.deviceId,
              name: result.device.name || ARDUINO_DEVICE_NAME,
              rssi: result.rssi,
            };

            // Update state immediately when found
            dispatch({
              type: 'SET_DEVICE_STATE',
              device: 'racket',
              state: {
                isConnected: false, // Not connected yet, just discovered
                isConnecting: true,
                name: result.device.name || ARDUINO_DEVICE_NAME,
              },
            });
          }
        );

        // Stop scan after timeout and attempt connection
        bleScanTimeoutRef.current = setTimeout(async () => {
          try {
            await BleClient.stopLEScan();
          } catch (e) {
            console.warn('Error stopping BLE scan:', e);
          }

          if (discoveredArduinoRef.current) {
            // Found a device, attempt connection
            try {
              await BleClient.connect(discoveredArduinoRef.current.deviceId, (deviceId) => {
                console.log('Arduino device disconnected:', deviceId);
                dispatch({
                  type: 'SET_DEVICE_STATE',
                  device: 'racket',
                  state: { isConnected: false, isConnecting: false, error: 'Device disconnected' },
                });
              });

              dispatch({
                type: 'SET_DEVICE_STATE',
                device: 'racket',
                state: {
                  isConnected: true,
                  isConnecting: false,
                  deviceId: discoveredArduinoRef.current.deviceId, // CRITICAL: Save deviceId for useRecordingSession
                  name: discoveredArduinoRef.current.name || ARDUINO_DEVICE_NAME,
                  hasIMU: true,
                  hasFSR: true, // Arduino supports both IMU and FSR
                },
              });
              console.log('Connected to Arduino racket sensor (IMU + FSR), deviceId:', discoveredArduinoRef.current.deviceId);
            } catch (connectErr) {
              console.error('Failed to connect to Arduino:', connectErr);
              dispatch({
                type: 'SET_DEVICE_STATE',
                device: 'racket',
                state: {
                  isConnected: false,
                  isConnecting: false,
                  error: connectErr instanceof Error ? connectErr.message : 'Connection failed',
                },
              });
            }
          } else {
            // No device found
            dispatch({
              type: 'SET_DEVICE_STATE',
              device: 'racket',
              state: {
                isConnected: false,
                isConnecting: false,
                error: 'No racket sensor found',
              },
            });
          }
        }, 5000); // 5 second scan timeout
      } catch (err) {
        console.error('BLE scan error:', err);
        dispatch({
          type: 'SET_DEVICE_STATE',
          device: 'racket',
          state: {
            isConnected: false,
            isConnecting: false,
            error: err instanceof Error ? err.message : 'BLE scan failed',
          },
        });
      }
    } else {
      // Simulate for web development
      setTimeout(() => {
        dispatch({
          type: 'SET_DEVICE_STATE',
          device: 'watch',
          state: { isConnected: true, isConnecting: false, name: "Ashley's Apple Watch (Simulated)" },
        });
      }, 1500);

      setTimeout(() => {
        dispatch({
          type: 'SET_DEVICE_STATE',
          device: 'racket',
          state: {
            isConnected: true,
            isConnecting: false,
            name: 'RacquetSense (Simulated)',
            hasIMU: true,
            hasFSR: true,
          },
        });
      }, 2000);
    }
  }, [isNative]);

  // Retry device connection
  const retryDeviceConnection = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', error: null });
    await startDeviceScan();
  }, [startDeviceScan]);

  // Set racket demo mode
  const setRacketDemoMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_DEMO_MODE', racketEnabled: enabled });

    if (enabled) {
      // Simulate racket connection when demo mode is enabled
      dispatch({
        type: 'SET_DEVICE_STATE',
        device: 'racket',
        state: {
          isConnected: true,
          isConnecting: false,
          name: 'RacquetSense (Demo)',
          hasIMU: true,
          hasFSR: true,
          error: undefined,
        },
      });
    } else {
      // Reset racket state when demo mode is disabled
      dispatch({
        type: 'SET_DEVICE_STATE',
        device: 'racket',
        state: {
          isConnected: false,
          isConnecting: false,
          name: undefined,
          hasIMU: false,
          hasFSR: false,
          error: undefined,
        },
      });
    }
  }, []);

  // Set duration
  const setDuration = useCallback((minutes: number) => {
    const clamped = Math.max(
      DEFAULT_DURATION_CONFIG.minMinutes,
      Math.min(DEFAULT_DURATION_CONFIG.maxMinutes, minutes)
    );
    dispatch({ type: 'SET_DURATION', minutes: clamped });
  }, []);

  /**
   * Get raw sum of FSR grid values for calibration display.
   * Returns the sum of all 32 sensor values (range 0-32736).
   * No scaling applied - raw values preserved for future processing.
   */
  const fsrRawSum = useCallback((fsrFrame: ArduinoFSRFrame): number => {
    return fsrFrame.flat.reduce((acc, val) => acc + val, 0);
  }, []);

  /**
   * Start FSR notifications for calibration data collection.
   * Must be called when Arduino is connected.
   */
  const startFSRCalibrationCollection = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!isNative || !deviceId) {
      console.warn('[Calibration] Cannot start FSR collection: not native or no deviceId');
      return false;
    }

    try {
      // Clear previous samples and assembler
      fsrCalibrationSamplesRef.current = [];
      fsrAssemblerRef.current.clear();

      // First, try to stop any existing notifications (in case they're still active from recording)
      try {
        await BleClient.stopNotifications(
          deviceId,
          ARDUINO_BLE_SERVICE_UUID,
          ARDUINO_SENSOR_DATA_CHAR_UUID
        );
        console.log('[Calibration] Stopped existing notifications');
      } catch {
        // Ignore - notifications might not be active
      }

      // Small delay to ensure clean state
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start FSR streaming on Arduino
      console.log('[Calibration] Sending START_FSR command to Arduino');
      await BleClient.write(
        deviceId,
        ARDUINO_BLE_SERVICE_UUID,
        ARDUINO_CONTROL_CHAR_UUID,
        new DataView(new Uint8Array([ArduinoCommand.START_FSR]).buffer)
      );

      // Start notifications
      console.log('[Calibration] Starting BLE notifications');
      await BleClient.startNotifications(
        deviceId,
        ARDUINO_BLE_SERVICE_UUID,
        ARDUINO_SENSOR_DATA_CHAR_UUID,
        (value: DataView) => {
          const packetType = getPacketType(value);
          if (packetType === PacketType.FSR) {
            const chunk = parseFSRChunk(value);
            if (chunk) {
              const frame = fsrAssemblerRef.current.addChunk(chunk);
              if (frame) {
                fsrCalibrationSamplesRef.current.push(frame);
                // Log occasionally for debugging
                if (fsrCalibrationSamplesRef.current.length % 50 === 1) {
                  console.log('[Calibration] FSR frames received:', fsrCalibrationSamplesRef.current.length);
                }
              }
            }
          }
        }
      );

      fsrNotificationActiveRef.current = true;
      console.log('[Calibration] Started FSR collection from Arduino');

      // Wait a moment for first frames to arrive
      await new Promise(resolve => setTimeout(resolve, 200));

      return true;
    } catch (err) {
      console.error('[Calibration] Failed to start FSR collection:', err);
      return false;
    }
  }, [isNative]);

  /**
   * Stop FSR notifications after calibration collection.
   */
  const stopFSRCalibrationCollection = useCallback(async (deviceId: string): Promise<void> => {
    if (!isNative || !deviceId || !fsrNotificationActiveRef.current) return;

    try {
      // Stop notifications
      await BleClient.stopNotifications(
        deviceId,
        ARDUINO_BLE_SERVICE_UUID,
        ARDUINO_SENSOR_DATA_CHAR_UUID
      );

      // Stop FSR streaming on Arduino
      await BleClient.write(
        deviceId,
        ARDUINO_BLE_SERVICE_UUID,
        ARDUINO_CONTROL_CHAR_UUID,
        new DataView(new Uint8Array([ArduinoCommand.STOP_FSR]).buffer)
      );

      fsrNotificationActiveRef.current = false;
      console.log('[Calibration] Stopped FSR collection, got', fsrCalibrationSamplesRef.current.length, 'frames');
    } catch (err) {
      console.error('[Calibration] Failed to stop FSR collection:', err);
    }
  }, [isNative]);

  /**
   * Get the latest FSR frame with raw values.
   * Returns null if no frames collected.
   * force = raw sum of all 32 sensors (no scaling)
   * fsrValues = raw grid values (32 sensors, 0-1023 each)
   */
  const getLatestFSRData = useCallback((): { force: number; fsrValues: number[] } | null => {
    const frames = fsrCalibrationSamplesRef.current;
    if (frames.length === 0) return null;

    const latestFrame = frames[frames.length - 1];
    return {
      force: fsrRawSum(latestFrame),
      fsrValues: latestFrame.flat,
    };
  }, [fsrRawSum]);

  // Calibration sequence
  const startCalibrationSequence = useCallback(async () => {
    console.log('Starting calibration sequence...');

    // Send start message to Watch
    if (isNative) {
      try {
        await WatchMotion.sendCalibrationCommand({
          type: 'CALIBRATE_START',
          message: 'Get ready to squeeze!',
        });
      } catch (err) {
        console.error('Failed to send calibration start to Watch:', err);
      }
    }

    // Go to countdown step
    dispatch({ type: 'SET_STEP', step: 'calibration_countdown' });
    dispatch({ type: 'SET_COUNTDOWN', value: 3 });

    // Determine if we should use real FSR data or demo mode
    const useRealFSR = !state.demoMode.racketEnabled &&
                       state.devices.racket.isConnected &&
                       state.devices.racket.deviceId;
    const arduinoDeviceId = state.devices.racket.deviceId;

    // Countdown 3, 2, 1
    const runCountdown = async () => {
      for (let i = 3; i >= 1; i--) {
        dispatch({ type: 'SET_COUNTDOWN', value: i });

        if (isNative) {
          try {
            await WatchMotion.sendCalibrationCommand({
              type: 'CALIBRATE_COUNTDOWN',
              countdown: i,
            });
          } catch (err) {
            console.error('Failed to send countdown to Watch:', err);
          }
        }

        await new Promise((resolve) => {
          calibrationTimerRef.current = setTimeout(resolve, 1000);
        });
      }

      // Start FSR collection if using real hardware
      let fsrCollectionStarted = false;
      if (useRealFSR && arduinoDeviceId) {
        console.log('[Calibration] Starting real FSR data collection, deviceId:', arduinoDeviceId);
        fsrCollectionStarted = await startFSRCalibrationCollection(arduinoDeviceId);
        console.log('[Calibration] FSR collection started:', fsrCollectionStarted);
      } else {
        console.log('[Calibration] Using demo mode - useRealFSR:', useRealFSR, 'deviceId:', arduinoDeviceId);
      }

      // Start squeeze collection
      dispatch({ type: 'SET_STEP', step: 'calibration_squeeze' });
      dispatch({ type: 'START_CALIBRATION_COLLECTION' });
      dispatch({ type: 'SET_SQUEEZE_PROGRESS', value: 1 });

      const calibrationStartTime = Date.now();
      const collectedSamples: CalibrationSample[] = [];

      // 5-second squeeze with progress updates
      for (let sec = 1; sec <= 5; sec++) {
        dispatch({ type: 'SET_SQUEEZE_PROGRESS', value: sec });

        if (isNative) {
          try {
            await WatchMotion.sendCalibrationCommand({
              type: 'CALIBRATE_SQUEEZE',
              progress: sec,
            });
          } catch (err) {
            console.error('Failed to send squeeze progress to Watch:', err);
          }
        }

        let sample: CalibrationSample;

        if (fsrCollectionStarted) {
          // Use real FSR data from Arduino
          const fsrData = getLatestFSRData();
          if (fsrData) {
            console.log('[Calibration] sec', sec, 'FSR force:', fsrData.force, 'frames:', fsrCalibrationSamplesRef.current.length);
            sample = {
              timestamp: Date.now() - calibrationStartTime,
              force: fsrData.force,
              fsrValues: fsrData.fsrValues,
            };
          } else {
            // No FSR data yet, use 0
            console.log('[Calibration] sec', sec, 'No FSR data available yet');
            sample = {
              timestamp: Date.now() - calibrationStartTime,
              force: 0,
            };
          }
        } else {
          // Demo mode or FSR collection failed: simulate force data collection
          const simulatedForce = 20 + Math.random() * 30 + (sec * 5);
          sample = {
            timestamp: Date.now() - calibrationStartTime,
            force: simulatedForce,
          };
        }

        collectedSamples.push(sample);
        dispatch({ type: 'ADD_CALIBRATION_SAMPLE', sample });
        dispatch({ type: 'UPDATE_MAX_FORCE', force: sample.force });

        await new Promise((resolve) => {
          calibrationTimerRef.current = setTimeout(resolve, 1000);
        });
      }

      // Stop FSR collection if it was started
      if (fsrCollectionStarted && arduinoDeviceId) {
        console.log('[Calibration] Stopping real FSR data collection');
        await stopFSRCalibrationCollection(arduinoDeviceId);
      }

      // Calibration complete
      const calibrationEndTime = Date.now();

      // Calculate max force from collected samples
      const maxForce = fsrCollectionStarted
        ? Math.max(...collectedSamples.map(s => s.force), 0)
        : 45 + Math.random() * 20; // Demo mode: simulated max force

      const calibrationResult: CalibrationData = {
        maxForce,
        timestamp: calibrationStartTime,
        durationMs: calibrationEndTime - calibrationStartTime,
        samples: collectedSamples,
      };

      dispatch({ type: 'FINISH_CALIBRATION', result: calibrationResult });
      dispatch({ type: 'SET_STEP', step: 'calibration_done' });

      if (isNative) {
        try {
          await WatchMotion.sendCalibrationCommand({
            type: 'CALIBRATE_DONE',
            maxForce,
          });
        } catch (err) {
          console.error('Failed to send calibration done to Watch:', err);
        }
      }

      // Auto-advance to calibration complete after delay
      await new Promise((resolve) => {
        calibrationTimerRef.current = setTimeout(resolve, 2000);
      });
      dispatch({ type: 'SET_STEP', step: 'calibration_complete' });
    };

    runCountdown();
  }, [isNative, state.demoMode.racketEnabled, state.devices.racket.isConnected, state.devices.racket.deviceId, startFSRCalibrationCollection, stopFSRCalibrationCollection, getLatestFSRData]);

  // Reset calibration
  const resetCalibration = useCallback(() => {
    // Clear any running timers
    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
    // Reset calibration state
    dispatch({ type: 'RESET_CALIBRATION' });
  }, []);

  // Post-calibration sequence (after recording ends)
  const startPostCalibrationSequence = useCallback(async () => {
    console.log('Starting post-calibration sequence...');

    // Send start message to Watch
    if (isNative) {
      try {
        await WatchMotion.sendCalibrationCommand({
          type: 'POST_CALIBRATE_START',
          message: 'Post-session calibration!',
        });
      } catch (err) {
        console.error('Failed to send post-calibration start to Watch:', err);
      }
    }

    // Go to countdown step
    dispatch({ type: 'SET_STEP', step: 'post_calibration_countdown' });
    dispatch({ type: 'SET_POST_CAL_COUNTDOWN', value: 3 });

    // Determine if we should use real FSR data or demo mode
    const useRealFSR = !state.demoMode.racketEnabled &&
                       state.devices.racket.isConnected &&
                       state.devices.racket.deviceId;
    const arduinoDeviceId = state.devices.racket.deviceId;

    // Countdown 3, 2, 1
    const runCountdown = async () => {
      for (let i = 3; i >= 1; i--) {
        dispatch({ type: 'SET_POST_CAL_COUNTDOWN', value: i });

        if (isNative) {
          try {
            await WatchMotion.sendCalibrationCommand({
              type: 'POST_CALIBRATE_COUNTDOWN',
              countdown: i,
            });
          } catch (err) {
            console.error('Failed to send post-cal countdown to Watch:', err);
          }
        }

        await new Promise((resolve) => {
          postCalibrationTimerRef.current = setTimeout(resolve, 1000);
        });
      }

      // Start FSR collection if using real hardware
      let fsrCollectionStarted = false;
      if (useRealFSR && arduinoDeviceId) {
        console.log('[Post-Calibration] Starting real FSR data collection, deviceId:', arduinoDeviceId);
        fsrCollectionStarted = await startFSRCalibrationCollection(arduinoDeviceId);
        console.log('[Post-Calibration] FSR collection started:', fsrCollectionStarted);
      } else {
        console.log('[Post-Calibration] Using demo mode - useRealFSR:', useRealFSR, 'deviceId:', arduinoDeviceId);
      }

      // Start squeeze collection
      dispatch({ type: 'SET_STEP', step: 'post_calibration_squeeze' });
      dispatch({ type: 'START_POST_CALIBRATION_COLLECTION' });
      dispatch({ type: 'SET_POST_CAL_SQUEEZE_PROGRESS', value: 1 });

      const calibrationStartTime = Date.now();
      const collectedSamples: CalibrationSample[] = [];

      // 5-second squeeze with progress updates
      for (let sec = 1; sec <= 5; sec++) {
        dispatch({ type: 'SET_POST_CAL_SQUEEZE_PROGRESS', value: sec });

        if (isNative) {
          try {
            await WatchMotion.sendCalibrationCommand({
              type: 'POST_CALIBRATE_SQUEEZE',
              progress: sec,
            });
          } catch (err) {
            console.error('Failed to send post-cal squeeze progress to Watch:', err);
          }
        }

        let sample: CalibrationSample;

        if (fsrCollectionStarted) {
          // Use real FSR data from Arduino
          const fsrData = getLatestFSRData();
          if (fsrData) {
            console.log('[Post-Calibration] sec', sec, 'FSR force:', fsrData.force, 'frames:', fsrCalibrationSamplesRef.current.length);
            sample = {
              timestamp: Date.now() - calibrationStartTime,
              force: fsrData.force,
              fsrValues: fsrData.fsrValues,
            };
          } else {
            // No FSR data yet, use 0
            console.log('[Post-Calibration] sec', sec, 'No FSR data available yet');
            sample = {
              timestamp: Date.now() - calibrationStartTime,
              force: 0,
            };
          }
        } else {
          // Demo mode or FSR collection failed: simulate force data (slightly lower than pre-cal to simulate fatigue)
          const simulatedForce = 18 + Math.random() * 25 + (sec * 4);
          sample = {
            timestamp: Date.now() - calibrationStartTime,
            force: simulatedForce,
          };
        }

        collectedSamples.push(sample);
        dispatch({ type: 'ADD_POST_CALIBRATION_SAMPLE', sample });
        dispatch({ type: 'UPDATE_POST_CAL_MAX_FORCE', force: sample.force });

        await new Promise((resolve) => {
          postCalibrationTimerRef.current = setTimeout(resolve, 1000);
        });
      }

      // Stop FSR collection if it was started
      if (fsrCollectionStarted && arduinoDeviceId) {
        console.log('[Post-Calibration] Stopping real FSR data collection');
        await stopFSRCalibrationCollection(arduinoDeviceId);
      }

      // Post-calibration complete
      const calibrationEndTime = Date.now();

      // Calculate max force from collected samples
      const maxForce = fsrCollectionStarted
        ? Math.max(...collectedSamples.map(s => s.force), 0)
        : 40 + Math.random() * 18; // Demo mode: slightly lower to simulate fatigue

      const postCalibrationResult: CalibrationData = {
        maxForce,
        timestamp: calibrationStartTime,
        durationMs: calibrationEndTime - calibrationStartTime,
        samples: collectedSamples,
      };

      dispatch({ type: 'FINISH_POST_CALIBRATION', result: postCalibrationResult });
      dispatch({ type: 'SET_STEP', step: 'post_calibration_complete' });

      if (isNative) {
        try {
          await WatchMotion.sendCalibrationCommand({
            type: 'POST_CALIBRATE_DONE',
            maxForce,
          });
        } catch (err) {
          console.error('Failed to send post-calibration done to Watch:', err);
        }
      }
    };

    runCountdown();
  }, [isNative, state.demoMode.racketEnabled, state.devices.racket.isConnected, state.devices.racket.deviceId, startFSRCalibrationCollection, stopFSRCalibrationCollection, getLatestFSRData]);

  // Skip post-calibration
  const skipPostCalibration = useCallback(() => {
    console.log('Skipping post-calibration...');
    // Navigate directly to session summary without post-calibration
    dispatch({ type: 'SET_STEP', step: 'post_calibration_complete' });
  }, []);

  // Reset post-calibration
  const resetPostCalibration = useCallback(() => {
    // Clear any running timers
    if (postCalibrationTimerRef.current) {
      clearTimeout(postCalibrationTimerRef.current);
      postCalibrationTimerRef.current = null;
    }
    // Reset post-calibration state
    dispatch({ type: 'RESET_POST_CALIBRATION' });
  }, []);

  // Camera controls
  const setCameraReady = useCallback((ready: boolean) => {
    dispatch({ type: 'SET_CAMERA_READY', ready });
  }, []);

  const setCameraPreview = useCallback((active: boolean) => {
    dispatch({ type: 'SET_CAMERA_PREVIEW', active });
  }, []);

  // Recording controls - now delegates to native RecordingStateMachine
  const startRecording = useCallback(async (startedBy: RecordingStartedBy) => {
    if (!state.sessionId) {
      console.error('[useRecordingWizard] No session ID set - cannot start recording');
      return;
    }

    console.log(`[useRecordingWizard] Starting recording (initiated by ${startedBy}), sessionId: ${state.sessionId}`);

    // Update local wizard state for UI
    dispatch({ type: 'START_RECORDING', startedBy });
    // Transition to recording_active step
    dispatch({ type: 'SET_STEP', step: 'recording_active' });

    // Request state machine to start (handles video, Watch, Arduino orchestration)
    if (isNative) {
      try {
        const arduinoDeviceId = state.devices.racket.deviceId || undefined;
        const result = await RecordingStateMachine.requestStart({
          sessionId: state.sessionId,
          arduinoDeviceId,
          plannedDuration: state.plannedDuration,
          startedBy: startedBy === 'watch' ? 'watch' : 'phone',
        });

        if (!result.success) {
          console.error('[useRecordingWizard] State machine failed to start:', result.error);
          // Revert wizard state on failure
          dispatch({ type: 'STOP_RECORDING' });
        } else {
          console.log('[useRecordingWizard] State machine started successfully');
        }
      } catch (err) {
        console.error('[useRecordingWizard] Error requesting state machine start:', err);
        dispatch({ type: 'STOP_RECORDING' });
      }
    }
  }, [state.sessionId, state.plannedDuration, state.devices.racket.deviceId, isNative]);

  const stopRecording = useCallback(async (): Promise<{ videoPath?: string } | null> => {
    console.log('[useRecordingWizard] Stopping recording...');

    // Update local wizard state
    dispatch({ type: 'STOP_RECORDING' });

    // Request state machine to stop (handles video, Watch, Arduino)
    if (isNative) {
      try {
        const result = await RecordingStateMachine.requestStop();

        if (!result.success) {
          console.error('[useRecordingWizard] State machine stop failed:', result.error);
          return null;
        } else {
          console.log('[useRecordingWizard] State machine stopped successfully');
          if (result.result?.videoPath) {
            console.log('[useRecordingWizard] Video saved at:', result.result.videoPath);
          }
          // Return the video path for the caller
          return { videoPath: result.result?.videoPath };
        }
      } catch (err) {
        console.error('[useRecordingWizard] Error requesting state machine stop:', err);
        return null;
      }
    }
    return null;
  }, [isNative]);

  // Enable Watch recording control when on camera preview
  useEffect(() => {
    if (state.currentStep === 'camera_preview' && state.sessionId && isNative) {
      const enableWatchControl = async () => {
        try {
          await WatchMotion.sendCalibrationCommand({
            type: 'ENABLE_RECORDING_CONTROL',
            sessionId: state.sessionId!,
          });
          dispatch({ type: 'ENABLE_WATCH_CONTROL' });
        } catch (err) {
          console.error('Failed to enable Watch recording control:', err);
        }
      };

      enableWatchControl();
    }
  }, [state.currentStep, state.sessionId, isNative]);

  // Listen for recording control messages from Watch (active during camera_preview and recording_active)
  useEffect(() => {
    const shouldListen = (state.currentStep === 'camera_preview' || state.currentStep === 'recording_active') && isNative;

    if (shouldListen && !recordingControlListenerRef.current) {
      const setupListener = async () => {
        try {
          console.log('Setting up Watch recording control listener...');
          const listener = await WatchMotion.addListener('recordingControl', (data: unknown) => {
            const message = data as { action: 'START' | 'STOP' };
            console.log('Watch recording control received:', message.action);

            if (message.action === 'START') {
              startRecording('watch');
              // Note: startRecording now handles the step transition to recording_active
            } else if (message.action === 'STOP') {
              console.log('Watch sent STOP - stopping recording...');
              stopRecording();
            }
          });
          recordingControlListenerRef.current = listener;
          console.log('Watch recording control listener set up successfully');
        } catch (err) {
          console.error('Failed to setup recording control listener:', err);
        }
      };

      setupListener();
    }

    // Cleanup when leaving both camera_preview and recording_active steps
    return () => {
      if (!shouldListen && recordingControlListenerRef.current) {
        console.log('Removing Watch recording control listener');
        recordingControlListenerRef.current.remove();
        recordingControlListenerRef.current = null;
      }
    };
  }, [state.currentStep, isNative, startRecording, stopRecording]);

  // Check device connection and auto-advance
  useEffect(() => {
    if (state.currentStep === 'finding_devices') {
      const { watch, racket } = state.devices;

      // If both connected, go to devices_connected
      if (watch.isConnected && racket.isConnected && !watch.isConnecting && !racket.isConnecting) {
        setTimeout(() => {
          dispatch({ type: 'SET_STEP', step: 'devices_connected' });
        }, 500);
      }

      // If either has error, go to devices_error
      if ((watch.error || racket.error) && !watch.isConnecting && !racket.isConnecting) {
        setTimeout(() => {
          dispatch({ type: 'SET_STEP', step: 'devices_error' });
        }, 500);
      }
    }
  }, [state.currentStep, state.devices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (calibrationTimerRef.current) {
        clearTimeout(calibrationTimerRef.current);
      }
      if (postCalibrationTimerRef.current) {
        clearTimeout(postCalibrationTimerRef.current);
      }
      if (recordingControlListenerRef.current) {
        recordingControlListenerRef.current.remove();
      }
      if (bleScanTimeoutRef.current) {
        clearTimeout(bleScanTimeoutRef.current);
      }
      // Stop BLE scan if active
      if (bleInitializedRef.current && isNative) {
        BleClient.stopLEScan().catch(() => {});
      }
    };
  }, [isNative]);

  return {
    state,
    goToStep,
    goNext,
    goBack,
    reset,
    startDeviceScan,
    retryDeviceConnection,
    setRacketDemoMode,
    setDuration,
    durationConfig: DEFAULT_DURATION_CONFIG,
    startCalibrationSequence,
    resetCalibration,
    startPostCalibrationSequence,
    skipPostCalibration,
    resetPostCalibration,
    setCameraReady,
    setCameraPreview,
    startRecording,
    stopRecording,
  };
}
