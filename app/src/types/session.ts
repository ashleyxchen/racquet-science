export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  status: 'recording' | 'completed' | 'corrupted';
  metadata: SessionMetadata;
  videoPath: string | null;
  hasWatchData: boolean;
  hasRacketData: boolean;
  hasFSRData: boolean;
  // Pre-calibration data
  calibrationMaxForce: number | null;
  calibrationTimestamp: number | null;
  calibrationDurationMs: number | null;
  // Post-calibration data
  postCalibrationMaxForce: number | null;
  postCalibrationTimestamp: number | null;
  postCalibrationDurationMs: number | null;
  // Session summary fields (computed from ball impact data)
  avgGripForceAtImpact: number | null;
  avgAccelerationAtImpact: number | null;
  avgVelocityAtImpact: number | null;
  // Efficiency by stroke type
  avgEfficiencyForehand: number | null;
  avgEfficiencyBackhand: number | null;
  avgEfficiencyServe: number | null;
  // Stroke counts
  strokeCountForehand: number;
  strokeCountBackhand: number;
  strokeCountServe: number;
}

/**
 * FSR sample for storage (optimized for file size)
 * Stores 4×8 grid as flattened array (row-major order)
 */
export interface FSRSample {
  /** Timestamp in ms (relative to session start) */
  t: number;
  /** Frame sequence number */
  seq: number;
  /** 32 pressure values (row-major: [r0c0, r0c1, ..., r3c7]) */
  values: number[];
}

/**
 * FSR data file structure
 */
export interface FSRDataFile {
  version: 1;
  sessionId: string;
  frameCount: number;
  sampleRate: number;
  gridSize: { rows: 4; cols: 8 };
  samples: FSRSample[];
}

export interface SessionMetadata {
  name?: string;
  description?: string;
  location?: string;
  conditions?: string;
  notes?: string;
  tags?: string[];
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Orientation {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface SensorSample {
  t: number; // ms from session start
  accel: Vec3;
  gyro: Vec3;
  orientation: Orientation;
  sequence?: number; // Sequence number for gap detection (100Hz binary streaming)
}

export interface SensorStream {
  source: 'watch' | 'racket';
  samples: SensorSample[];
  sampleRate: number;
  startTimestamp: number;
}

export interface EventMarker {
  id: string;
  timestamp: number; // ms from session start
  type: 'impact' | 'pain' | 'note' | 'milestone';
  label?: string;
  severity?: number; // 1-10 for pain events
  bodyLocation?: string;
  notes?: string;
}

/**
 * Voice-recorded pain note from Apple Watch
 * Captured via speech recognition during a recording session
 */
export interface PainNote {
  /** Unique identifier for the pain note */
  id: string;
  /** Timestamp in ms relative to session start */
  timestamp: number;
  /** Transcribed text from voice recording */
  text: string;
  /** Pain severity level (1-10) */
  painLevel: number;
}

export interface SessionData {
  session: Session;
  watchData: SensorSample[];
  racketData: SensorSample[];
  markers: EventMarker[];
}

// For creating new sessions
export interface CreateSessionInput {
  metadata: SessionMetadata;
}

// For listing sessions
export interface ListSessionsOptions {
  limit?: number;
  offset?: number;
  startDate?: number;
  endDate?: number;
}
