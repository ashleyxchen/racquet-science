/**
 * Type definitions for the Recording Session Wizard
 * Supports multi-step wizard flow: Device Connection → Duration → Calibration → Camera → Recording
 */

// Wizard Steps
export type WizardStep =
  | 'finding_devices'
  | 'devices_connected'
  | 'devices_error'
  | 'duration_picker'
  | 'calibration_intro'
  | 'calibration_instructions'
  | 'calibration_countdown'
  | 'calibration_squeeze'
  | 'calibration_done'
  | 'calibration_complete'
  | 'camera_setup_intro'
  | 'camera_instructions'
  | 'camera_preview'
  | 'recording_active'
  // Post-calibration steps (after recording)
  | 'post_calibration_intro'
  | 'post_calibration_countdown'
  | 'post_calibration_squeeze'
  | 'post_calibration_complete';

// Device Connection State
export interface DeviceState {
  isConnected: boolean;
  isConnecting: boolean;
  name?: string;
  error?: string;
}

// Extended racket device state with sensor capabilities
export interface RacketDeviceState extends DeviceState {
  hasIMU: boolean;
  hasFSR: boolean;
}

export interface DeviceConnectionState {
  watch: DeviceState;
  racket: RacketDeviceState;
}

// Duration Selection
export interface DurationConfig {
  minMinutes: number;
  maxMinutes: number;
  defaultMinutes: number;
}

// Calibration Data
export interface CalibrationData {
  maxForce: number;
  timestamp: number;
  durationMs: number;
  samples?: CalibrationSample[];
}

export interface CalibrationSample {
  timestamp: number;
  force: number;
  accel?: { x: number; y: number; z: number };
  gyro?: { x: number; y: number; z: number };
}

// Calibration State
export interface CalibrationState {
  countdown: number; // 3, 2, 1, 0
  squeezeProgress: number; // 1-5 (seconds)
  isCollecting: boolean;
  maxForce: number;
  samples: CalibrationSample[];
}

// Camera State
export interface CameraState {
  isReady: boolean;
  isPreviewActive: boolean;
  error?: string;
}

// Recording Control
export type RecordingStartedBy = 'phone' | 'watch';

export interface RecordingControlState {
  canStartFromWatch: boolean;
  isRecording: boolean;
  startedBy?: RecordingStartedBy;
  startTime?: number;
}

// Demo mode settings
export interface DemoModeState {
  racketEnabled: boolean; // When true, simulates racket connection
}

// Post-Calibration State (mirrors CalibrationState)
export interface PostCalibrationState {
  countdown: number; // 3, 2, 1, 0
  squeezeProgress: number; // 1-5 (seconds)
  isCollecting: boolean;
  maxForce: number;
  samples: CalibrationSample[];
}

// Full Wizard State
export interface WizardState {
  currentStep: WizardStep;
  sessionId: string | null;
  devices: DeviceConnectionState;
  demoMode: DemoModeState;
  plannedDuration: number; // minutes
  calibration: CalibrationState;
  calibrationResult: CalibrationData | null;
  postCalibration: PostCalibrationState;
  postCalibrationResult: CalibrationData | null;
  camera: CameraState;
  recording: RecordingControlState;
  error: string | null;
}

// Wizard Actions
export type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_SESSION_ID'; sessionId: string }
  | { type: 'SET_DEVICE_STATE'; device: 'watch' | 'racket'; state: Partial<DeviceState> }
  | { type: 'SET_DEMO_MODE'; racketEnabled: boolean }
  | { type: 'SET_DURATION'; minutes: number }
  | { type: 'SET_COUNTDOWN'; value: number }
  | { type: 'SET_SQUEEZE_PROGRESS'; value: number }
  | { type: 'START_CALIBRATION_COLLECTION' }
  | { type: 'ADD_CALIBRATION_SAMPLE'; sample: CalibrationSample }
  | { type: 'UPDATE_MAX_FORCE'; force: number }
  | { type: 'FINISH_CALIBRATION'; result: CalibrationData }
  | { type: 'RESET_CALIBRATION' }
  | { type: 'SET_CAMERA_READY'; ready: boolean }
  | { type: 'SET_CAMERA_PREVIEW'; active: boolean }
  | { type: 'SET_CAMERA_ERROR'; error: string }
  | { type: 'ENABLE_WATCH_CONTROL' }
  | { type: 'START_RECORDING'; startedBy: RecordingStartedBy }
  | { type: 'STOP_RECORDING' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' }
  // Post-calibration actions
  | { type: 'SET_POST_CAL_COUNTDOWN'; value: number }
  | { type: 'SET_POST_CAL_SQUEEZE_PROGRESS'; value: number }
  | { type: 'START_POST_CALIBRATION_COLLECTION' }
  | { type: 'ADD_POST_CALIBRATION_SAMPLE'; sample: CalibrationSample }
  | { type: 'UPDATE_POST_CAL_MAX_FORCE'; force: number }
  | { type: 'FINISH_POST_CALIBRATION'; result: CalibrationData }
  | { type: 'RESET_POST_CALIBRATION' };

// Watch Sync Commands (iOS → Watch)
export type WatchCalibrationCommand =
  | { type: 'CALIBRATE_START'; message: string }
  | { type: 'CALIBRATE_COUNTDOWN'; countdown: number }
  | { type: 'CALIBRATE_SQUEEZE'; progress: number }
  | { type: 'CALIBRATE_DONE'; maxForce: number }
  | { type: 'ENABLE_RECORDING_CONTROL'; sessionId: string };

// Watch Control Messages (Watch → iOS)
export interface WatchRecordingControlMessage {
  type: 'recording_control';
  action: 'START' | 'STOP';
  timestamp: number;
}

// Props for step components
export interface WizardStepProps {
  state: WizardState;
  onNext: () => void;
  onBack: () => void;
  onRetry?: () => void;
}

// Initial state factory
export function createInitialWizardState(): WizardState {
  return {
    currentStep: 'finding_devices',
    sessionId: null,
    devices: {
      watch: { isConnected: false, isConnecting: false },
      racket: { isConnected: false, isConnecting: false, hasIMU: false, hasFSR: false },
    },
    demoMode: {
      racketEnabled: false,
    },
    plannedDuration: 30, // Default 30 minutes
    calibration: {
      countdown: 3,
      squeezeProgress: 0,
      isCollecting: false,
      maxForce: 0,
      samples: [],
    },
    calibrationResult: null,
    postCalibration: {
      countdown: 3,
      squeezeProgress: 0,
      isCollecting: false,
      maxForce: 0,
      samples: [],
    },
    postCalibrationResult: null,
    camera: {
      isReady: false,
      isPreviewActive: false,
    },
    recording: {
      canStartFromWatch: false,
      isRecording: false,
    },
    error: null,
  };
}

// Duration config defaults
export const DEFAULT_DURATION_CONFIG: DurationConfig = {
  minMinutes: 5,
  maxMinutes: 60,
  defaultMinutes: 30,
};
