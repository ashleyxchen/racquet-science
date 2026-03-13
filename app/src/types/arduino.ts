/**
 * Type definitions for Arduino BLE sensor integration
 *
 * Defines the data structures for communicating with the
 * Arduino Nano 33 BLE Sense Rev2 + FSR grid over Bluetooth Low Energy.
 *
 * Combined sensor protocol:
 * - IMU (accelerometer + gyroscope) @ 100Hz
 * - FSR 4x8 pressure grid @ 100Hz (8-bit packed format)
 */

// ============================================================================
// BLE UUIDs
// ============================================================================

export const ARDUINO_BLE_SERVICE_UUID = '19B10000-E8F2-537E-4F6C-D104768A1214';
export const ARDUINO_SENSOR_DATA_CHAR_UUID = '19B10001-E8F2-537E-4F6C-D104768A1214';
export const ARDUINO_CONTROL_CHAR_UUID = '19B10002-E8F2-537E-4F6C-D104768A1214';
export const ARDUINO_CONFIG_CHAR_UUID = '19B10003-E8F2-537E-4F6C-D104768A1214';

// Legacy alias
export const ARDUINO_IMU_DATA_CHAR_UUID = ARDUINO_SENSOR_DATA_CHAR_UUID;

// Device name for scanning
export const ARDUINO_DEVICE_NAME = 'RacquetSense';

// ============================================================================
// Packet Types
// ============================================================================

export enum PacketType {
  IMU = 0x01,
  FSR = 0x02,
  STATUS = 0x03,
}

// ============================================================================
// Control Commands
// ============================================================================

export enum ArduinoCommand {
  START_ALL = 0x01,
  STOP_ALL = 0x02,
  PING = 0x03,
  START_IMU = 0x11,
  STOP_IMU = 0x12,
  START_FSR = 0x21,
  STOP_FSR = 0x22,
}

// Legacy aliases
export const ArduinoCommandLegacy = {
  START: ArduinoCommand.START_ALL,
  STOP: ArduinoCommand.STOP_ALL,
  PING: ArduinoCommand.PING,
};

// ============================================================================
// FSR Grid Configuration
// ============================================================================

export const FSR_ROWS = 4;
export const FSR_COLS = 8;
export const FSR_TOTAL_SENSORS = FSR_ROWS * FSR_COLS; // 32

// Packed format: 2 chunks of 16 sensors each (8-bit values)
export const FSR_CHUNKS = 2;
export const FSR_SENSORS_PER_CHUNK = 16;

// ============================================================================
// IMU Data Types
// ============================================================================

/**
 * Raw IMU sample from Arduino (parsed from 20-byte BLE packet)
 */
export interface ArduinoIMURawSample {
  /** Milliseconds since START command */
  timestamp: number;
  /** Raw accelerometer values (int16, scaled) */
  accelRaw: { x: number; y: number; z: number };
  /** Raw gyroscope values (int16, scaled) */
  gyroRaw: { x: number; y: number; z: number };
  /** Packet sequence number (for loss detection) */
  sequence: number;
  /** Reserved byte */
  reserved: number;
}

/**
 * Converted IMU sample with physical units
 */
export interface ArduinoIMUSample {
  /** Milliseconds since START command (relative to Arduino) */
  timestamp: number;
  /** Accelerometer values in g (±4g range) */
  accel: { x: number; y: number; z: number };
  /** Gyroscope values in degrees per second (±2000 dps range) */
  gyro: { x: number; y: number; z: number };
  /** Packet sequence number */
  sequence: number;
}

// ============================================================================
// FSR Data Types
// ============================================================================

/**
 * Single FSR frame chunk (16 sensors, 8-bit packed format)
 * Chunk 0: sensors 0-15 (rows 0-1)
 * Chunk 1: sensors 16-31 (rows 2-3)
 */
export interface ArduinoFSRChunk {
  /** Frame sequence number */
  frameSequence: number;
  /** Chunk index (0-1) */
  chunkIndex: number;
  /** 16 sensor values (scaled back to 10-bit range, 0-1020) */
  values: number[];
}

/**
 * Complete FSR frame (all 32 sensors)
 */
export interface ArduinoFSRFrame {
  /** Frame sequence number */
  frameSequence: number;
  /** Timestamp when frame was completed (local) */
  timestamp: number;
  /**
   * 4x8 grid of pressure values (0-1023)
   * grid[row][col] where row=0-3, col=0-7
   */
  grid: number[][];
  /**
   * Flattened array of 32 values (row-major order)
   * For sensors 0-31: index = row * 8 + col
   */
  flat: number[];
}

/**
 * FSR sample for storage (flattened for efficiency)
 */
export interface ArduinoFSRSample {
  /** Timestamp in ms (relative to session start) */
  timestamp: number;
  /** Frame sequence number */
  sequence: number;
  /** 32 pressure values (row-major: [r0c0, r0c1, ..., r3c7]) */
  values: number[];
}

// ============================================================================
// Status Data Types
// ============================================================================

export interface ArduinoStatus {
  /** Timestamp in ms (0 if not streaming) */
  timestamp: number;
  /** IMU streaming active */
  imuStreaming: boolean;
  /** FSR streaming active */
  fsrStreaming: boolean;
  /** Battery level (0-100) */
  battery: number;
  /** Current IMU sequence number */
  imuSequence: number;
  /** Current FSR frame sequence number */
  fsrSequence: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Sensor configuration (matches Arduino config characteristic)
 */
export interface ArduinoSensorConfig {
  /** IMU sample rate in Hz (50 or 100) */
  imuRate: number;
  /** FSR sample rate in Hz (10, 20, or 50) */
  fsrRate: number;
  /** Accelerometer range in g (2, 4, 8, 16) */
  accelRange: number;
  /** Gyroscope range in dps (250, 500, 1000, 2000) */
  gyroRange: number;
}

// Legacy alias
export interface ArduinoIMUConfig {
  sampleRate: number;
  accelRange: number;
  gyroRange: number;
}

// ============================================================================
// Connection State
// ============================================================================

export type ArduinoConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'error';

export interface ArduinoDevice {
  deviceId: string;
  name: string | null;
  rssi?: number;
}

export interface ArduinoConnectionStatus {
  state: ArduinoConnectionState;
  device: ArduinoDevice | null;
  error: string | null;
  /** Number of IMU packets received */
  imuPacketCount: number;
  /** Number of FSR frames received */
  fsrFrameCount: number;
  /** Estimated IMU packet loss rate (0-1) */
  imuPacketLossRate: number;
  /** Last seen IMU sequence number */
  lastImuSequence: number;
  /** Last seen FSR frame sequence number */
  lastFsrSequence: number;
  // Legacy aliases
  packetCount: number;
  packetLossRate: number;
  lastSequence: number;
}

// ============================================================================
// Hook Result Interface
// ============================================================================

export interface UseArduinoBleResult {
  // Connection state
  connectionStatus: ArduinoConnectionStatus;
  isScanning: boolean;
  isConnected: boolean;
  isStreaming: boolean;

  // Discovered devices
  discoveredDevices: ArduinoDevice[];

  // Actions
  scan: (timeout?: number) => Promise<void>;
  stopScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startStreaming: (options?: { imu?: boolean; fsr?: boolean }) => Promise<void>;
  stopStreaming: (options?: { imu?: boolean; fsr?: boolean }) => Promise<void>;
  sendPing: () => Promise<void>;

  // Configuration
  config: ArduinoSensorConfig | null;
  setConfig: (config: Partial<ArduinoSensorConfig>) => Promise<void>;

  // IMU Data
  latestIMUSample: ArduinoIMUSample | null;
  onIMUSample: (callback: (sample: ArduinoIMUSample) => void) => () => void;

  // FSR Data
  latestFSRFrame: ArduinoFSRFrame | null;
  onFSRFrame: (callback: (frame: ArduinoFSRFrame) => void) => () => void;

  // Legacy aliases
  latestSample: ArduinoIMUSample | null;
  onSample: (callback: (sample: ArduinoIMUSample) => void) => () => void;
}

// ============================================================================
// Packet Constants
// ============================================================================

/** Size of all packets in bytes */
export const PACKET_SIZE = 20;

/** Scaling factors for IMU conversion */
export const ACCEL_SCALE = 4.0 / 32768.0;  // Convert int16 to g (±4g range)
export const GYRO_SCALE = 2000.0 / 32768.0;  // Convert int16 to dps (±2000 dps range)

/** FSR ADC max value (10-bit) */
export const FSR_ADC_MAX = 1023;

/** Status response sequence number (0xFFFF) */
export const STATUS_SEQUENCE = 0xFFFF;
