import type { SessionResponse } from '../services/api/sessions';
import type { StrokeEvent, PainNote, GripForceData } from './charts';

export interface SessionDetailData {
  session: SessionResponse;
  sensorData: SensorDataForCharts;
  fsrData?: FSRDataForCharts;
  gripForceData?: GripForceData[];
  strokes?: StrokeEvent[];
  painNotes?: PainNote[];
  videoUrl?: string;
}

/**
 * FSR grid data formatted for visualization
 */
export interface FSRDataForCharts {
  /** Array of timestamps in seconds */
  timestamps: number[];
  /** Array of frames, each with 32 values (4×8 grid, row-major) */
  frames: number[][];
  /** Total number of frames */
  frameCount: number;
  /** Grid dimensions */
  gridSize: { rows: 4; cols: 8 };
}

export interface SensorDataForCharts {
  accel: {
    x: number[];
    y: number[];
    z: number[];
  };
  gyro: {
    x: number[];
    y: number[];
    z: number[];
  };
  timestamps: number[]; // seconds
  source: 'watch' | 'arduino';
}

export interface CalibrationDisplayData {
  pre?: {
    maxForce: number;
    timestamp: string;
  };
  post?: {
    maxForce: number;
    timestamp: string;
  };
}

export type SessionTab = 'full-session' | 'summary' | 'zoom-in';

export interface ZoomRange {
  startTime: number; // seconds
  duration: number; // seconds
}
