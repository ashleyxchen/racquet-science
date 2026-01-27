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
}

export interface SessionMetadata {
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
