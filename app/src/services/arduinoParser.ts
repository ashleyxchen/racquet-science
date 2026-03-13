/**
 * Arduino BLE Sensor Packet Parser
 *
 * Parses 20-byte binary packets from the Arduino Nano 33 BLE Sense Rev2 + FSR grid.
 * Handles both IMU and FSR data packets based on type header.
 *
 * Packet Types:
 * - 0x01: IMU data (accelerometer + gyroscope)
 * - 0x02: FSR data (pressure grid chunk)
 * - 0x03: Status response
 *
 * IMU Packet Format (20 bytes, little-endian):
 * - Byte 0:      type (0x01)
 * - Bytes 1-4:   timestamp_ms (uint32)
 * - Bytes 5-6:   accel_x (int16)
 * - Bytes 7-8:   accel_y (int16)
 * - Bytes 9-10:  accel_z (int16)
 * - Bytes 11-12: gyro_x (int16)
 * - Bytes 13-14: gyro_y (int16)
 * - Bytes 15-16: gyro_z (int16)
 * - Bytes 17-18: sequence (uint16)
 * - Byte 19:     reserved
 *
 * FSR Packet Format (20 bytes, little-endian, 8-bit packed @ 100Hz):
 * - Byte 0:      type (0x02)
 * - Bytes 1-2:   frame_seq (uint16)
 * - Byte 3:      chunk_idx (uint8, 0-1)
 * - Bytes 4-19:  data (uint8 × 16 sensors, scaled from 10-bit ADC)
 *
 * 8-bit scaling: ADC value >> 2, reconstruct with << 2
 *
 * Status Packet Format (20 bytes, little-endian):
 * - Byte 0:      type (0x03)
 * - Bytes 1-4:   timestamp (uint32)
 * - Byte 5:      streaming flags (0x01=IMU, 0x02=FSR)
 * - Byte 6:      battery (0-100)
 * - Bytes 7-8:   imu_seq (uint16)
 * - Bytes 9-10:  fsr_seq (uint16)
 * - Bytes 11-19: reserved
 */

import {
  ArduinoIMURawSample,
  ArduinoIMUSample,
  ArduinoIMUConfig,
  ArduinoSensorConfig,
  ArduinoFSRChunk,
  ArduinoFSRFrame,
  ArduinoStatus,
  PacketType,
  ACCEL_SCALE,
  GYRO_SCALE,
  PACKET_SIZE,
  FSR_ROWS,
  FSR_COLS,
  FSR_CHUNKS,
  FSR_SENSORS_PER_CHUNK,
} from '../types/arduino';

// ============================================================================
// Packet Type Detection
// ============================================================================

/**
 * Get the packet type from the first byte
 */
export function getPacketType(data: DataView): PacketType | null {
  if (data.byteLength < 1) return null;
  const type = data.getUint8(0);
  if (type === PacketType.IMU || type === PacketType.FSR || type === PacketType.STATUS) {
    return type;
  }
  return null;
}

/**
 * Check if packet is an IMU packet
 */
export function isIMUPacket(data: DataView): boolean {
  return getPacketType(data) === PacketType.IMU;
}

/**
 * Check if packet is an FSR packet
 */
export function isFSRPacket(data: DataView): boolean {
  return getPacketType(data) === PacketType.FSR;
}

/**
 * Check if packet is a status packet
 */
export function isStatusPacket(data: DataView): boolean {
  return getPacketType(data) === PacketType.STATUS;
}

// ============================================================================
// IMU Packet Parsing
// ============================================================================

/**
 * Parse raw BLE data into a raw IMU sample
 * @param data - DataView containing the 20-byte packet
 * @returns Parsed raw sample or null if invalid
 */
export function parseRawIMUPacket(data: DataView): ArduinoIMURawSample | null {
  if (data.byteLength !== PACKET_SIZE) {
    console.warn(`Invalid packet size: ${data.byteLength}, expected ${PACKET_SIZE}`);
    return null;
  }

  if (data.getUint8(0) !== PacketType.IMU) {
    return null;
  }

  try {
    // Read timestamp (uint32, little-endian) at offset 1
    const timestamp = data.getUint32(1, true);

    // Read accelerometer values (int16, little-endian)
    const accelX = data.getInt16(5, true);
    const accelY = data.getInt16(7, true);
    const accelZ = data.getInt16(9, true);

    // Read gyroscope values (int16, little-endian)
    const gyroX = data.getInt16(11, true);
    const gyroY = data.getInt16(13, true);
    const gyroZ = data.getInt16(15, true);

    // Read sequence number (uint16, little-endian)
    const sequence = data.getUint16(17, true);

    // Read reserved byte
    const reserved = data.getUint8(19);

    return {
      timestamp,
      accelRaw: { x: accelX, y: accelY, z: accelZ },
      gyroRaw: { x: gyroX, y: gyroY, z: gyroZ },
      sequence,
      reserved,
    };
  } catch (error) {
    console.error('Error parsing IMU packet:', error);
    return null;
  }
}

/**
 * Legacy parser for packets without type header (backward compatibility)
 */
export function parseRawPacket(data: DataView): ArduinoIMURawSample | null {
  // First try new format with type header
  if (data.byteLength === PACKET_SIZE && data.getUint8(0) === PacketType.IMU) {
    return parseRawIMUPacket(data);
  }

  // Fall back to legacy format (no type header)
  if (data.byteLength !== PACKET_SIZE) {
    console.warn(`Invalid packet size: ${data.byteLength}, expected ${PACKET_SIZE}`);
    return null;
  }

  try {
    const timestamp = data.getUint32(0, true);
    const accelX = data.getInt16(4, true);
    const accelY = data.getInt16(6, true);
    const accelZ = data.getInt16(8, true);
    const gyroX = data.getInt16(10, true);
    const gyroY = data.getInt16(12, true);
    const gyroZ = data.getInt16(14, true);
    const sequence = data.getUint16(16, true);
    const reserved = data.getUint16(18, true);

    return {
      timestamp,
      accelRaw: { x: accelX, y: accelY, z: accelZ },
      gyroRaw: { x: gyroX, y: gyroY, z: gyroZ },
      sequence,
      reserved,
    };
  } catch (error) {
    console.error('Error parsing legacy IMU packet:', error);
    return null;
  }
}

/**
 * Convert raw IMU sample to physical units
 */
export function convertToPhysicalUnits(raw: ArduinoIMURawSample): ArduinoIMUSample {
  return {
    timestamp: raw.timestamp,
    accel: {
      x: raw.accelRaw.x * ACCEL_SCALE,
      y: raw.accelRaw.y * ACCEL_SCALE,
      z: raw.accelRaw.z * ACCEL_SCALE,
    },
    gyro: {
      x: raw.gyroRaw.x * GYRO_SCALE,
      y: raw.gyroRaw.y * GYRO_SCALE,
      z: raw.gyroRaw.z * GYRO_SCALE,
    },
    sequence: raw.sequence,
  };
}

/**
 * Parse BLE notification data directly to physical units
 */
export function parseIMUPacket(data: DataView): ArduinoIMUSample | null {
  const raw = parseRawIMUPacket(data) || parseRawPacket(data);
  if (!raw) return null;
  return convertToPhysicalUnits(raw);
}

// ============================================================================
// FSR Packet Parsing
// ============================================================================

/**
 * Parse FSR chunk packet (8-bit packed format)
 * @param data - DataView containing the 20-byte FSR packet
 * @returns Parsed FSR chunk or null if invalid
 *
 * New format: 2 chunks of 16 sensors each (8-bit values)
 * - Chunk 0: sensors 0-15 (rows 0-1)
 * - Chunk 1: sensors 16-31 (rows 2-3)
 */
export function parseFSRChunk(data: DataView): ArduinoFSRChunk | null {
  if (data.byteLength !== PACKET_SIZE) {
    console.warn(`[FSR] Invalid packet size: ${data.byteLength}, expected ${PACKET_SIZE}`);
    return null;
  }

  const typeByte = data.getUint8(0);
  if (typeByte !== PacketType.FSR) {
    // Debug: log what type we got instead
    console.debug(`[FSR] Packet type mismatch: got 0x${typeByte.toString(16)}, expected 0x${PacketType.FSR.toString(16)}`);
    return null;
  }

  try {
    const frameSequence = data.getUint16(1, true);
    const chunkIndex = data.getUint8(3);

    if (chunkIndex >= FSR_CHUNKS) {
      console.warn(`[FSR] Invalid chunk index: ${chunkIndex}, max is ${FSR_CHUNKS - 1}`);
      return null;
    }

    // Read 16 sensor values (uint8 each, scale back to 10-bit range)
    const values: number[] = [];
    for (let i = 0; i < FSR_SENSORS_PER_CHUNK; i++) {
      // Scale 8-bit (0-255) back to ~10-bit range (0-1020) by left-shifting 2 bits
      const val8 = data.getUint8(4 + i);
      values.push(val8 << 2);
    }

    // Debug: log successful parse occasionally
    if (frameSequence % 100 === 0 && chunkIndex === 0) {
      console.debug(`[FSR] Parsed chunk: seq=${frameSequence}, chunk=${chunkIndex}, first3Values=[${values.slice(0, 3).join(',')}]`);
    }

    return {
      frameSequence,
      chunkIndex,
      values,
    };
  } catch (error) {
    console.error('[FSR] Error parsing packet:', error);
    return null;
  }
}

/**
 * FSR Frame Assembler - collects chunks and assembles complete frames
 *
 * New 8-bit packed format: 2 chunks of 16 sensors each
 * - Chunk 0: sensors 0-15 (rows 0-1)
 * - Chunk 1: sensors 16-31 (rows 2-3)
 */
export class FSRFrameAssembler {
  private chunks: Map<number, ArduinoFSRChunk[]> = new Map();
  private lastCompleteFrame: ArduinoFSRFrame | null = null;

  /**
   * Add a chunk and return complete frame if all 2 chunks received
   */
  addChunk(chunk: ArduinoFSRChunk): ArduinoFSRFrame | null {
    const { frameSequence, chunkIndex } = chunk;

    // Get or create chunk array for this frame
    if (!this.chunks.has(frameSequence)) {
      this.chunks.set(frameSequence, []);
      // Clean up old frames (keep only last 3)
      if (this.chunks.size > 3) {
        const oldestSeq = Math.min(...this.chunks.keys());
        this.chunks.delete(oldestSeq);
      }
    }

    const frameChunks = this.chunks.get(frameSequence)!;

    // Add chunk if not already present
    if (!frameChunks.some(c => c.chunkIndex === chunkIndex)) {
      frameChunks.push(chunk);
    }

    // Debug: log chunk reception occasionally
    if (frameSequence % 100 === 0) {
      console.debug(`[FSR Assembler] seq=${frameSequence}, received chunk ${chunkIndex}, total chunks=${frameChunks.length}/${FSR_CHUNKS}`);
    }

    // Check if frame is complete (all 2 chunks)
    if (frameChunks.length === FSR_CHUNKS) {
      const frame = this.assembleFrame(frameSequence, frameChunks);
      this.chunks.delete(frameSequence);
      this.lastCompleteFrame = frame;

      // Debug: log frame completion occasionally
      if (frameSequence % 100 === 0) {
        console.debug(`[FSR Assembler] Frame ${frameSequence} complete!`);
      }
      return frame;
    }

    return null;
  }

  /**
   * Assemble a complete frame from 2 chunks (16 sensors each)
   *
   * Chunk 0 contains sensors 0-15 (rows 0-1, 8 cols each)
   * Chunk 1 contains sensors 16-31 (rows 2-3, 8 cols each)
   */
  private assembleFrame(frameSequence: number, chunks: ArduinoFSRChunk[]): ArduinoFSRFrame {
    // Sort by chunk index
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    // Build 2D grid from packed chunks
    const grid: number[][] = [];
    const flat: number[] = [];

    for (let row = 0; row < FSR_ROWS; row++) {
      // Determine which chunk and offset this row comes from
      const chunkIdx = Math.floor(row / 2);  // 0 for rows 0-1, 1 for rows 2-3
      const rowInChunk = row % 2;            // 0 or 1 within the chunk
      const chunk = chunks.find(c => c.chunkIndex === chunkIdx);

      const rowValues: number[] = [];
      for (let col = 0; col < FSR_COLS; col++) {
        const sensorIdx = rowInChunk * FSR_COLS + col;
        const value = chunk ? chunk.values[sensorIdx] : 0;
        rowValues.push(value);
        flat.push(value);
      }
      grid.push(rowValues);
    }

    return {
      frameSequence,
      timestamp: Date.now(),
      grid,
      flat,
    };
  }

  /**
   * Get the last complete frame
   */
  getLastFrame(): ArduinoFSRFrame | null {
    return this.lastCompleteFrame;
  }

  /**
   * Clear all pending chunks
   */
  clear(): void {
    this.chunks.clear();
    this.lastCompleteFrame = null;
  }
}

// ============================================================================
// Status Packet Parsing
// ============================================================================

/**
 * Legacy: Check if a packet is a status response (from PING command)
 * For backward compatibility with old firmware
 */
export function isStatusResponse(data: DataView): boolean {
  if (data.byteLength !== PACKET_SIZE) return false;

  // New format: check type byte
  if (data.getUint8(0) === PacketType.STATUS) {
    return true;
  }

  // Legacy format: sequence = 0xFFFF
  const sequence = data.getUint16(16, true);
  return sequence === 0xFFFF;
}

/**
 * Parse status response packet
 */
export function parseStatusResponse(data: DataView): ArduinoStatus | null {
  if (data.byteLength !== PACKET_SIZE) return null;

  // New format with type header
  if (data.getUint8(0) === PacketType.STATUS) {
    const timestamp = data.getUint32(1, true);
    const streamingFlags = data.getUint8(5);
    const battery = data.getUint8(6);
    const imuSequence = data.getUint16(7, true);
    const fsrSequence = data.getUint16(9, true);

    return {
      timestamp,
      imuStreaming: (streamingFlags & 0x01) !== 0,
      fsrStreaming: (streamingFlags & 0x02) !== 0,
      battery,
      imuSequence,
      fsrSequence,
    };
  }

  // Legacy format
  const sequence = data.getUint16(16, true);
  if (sequence === 0xFFFF) {
    return {
      timestamp: 0,
      imuStreaming: data.getUint8(18) === 1,
      fsrStreaming: false,
      battery: data.getUint8(19),
      imuSequence: 0,
      fsrSequence: 0,
    };
  }

  return null;
}

// ============================================================================
// Configuration Parsing
// ============================================================================

/**
 * Parse config characteristic value (new 4-byte format)
 */
export function parseSensorConfig(data: DataView): ArduinoSensorConfig | null {
  if (data.byteLength === 4) {
    return {
      imuRate: data.getUint8(0),
      fsrRate: data.getUint8(1),
      accelRange: data.getUint8(2),
      gyroRange: data.getUint8(3) * 10,
    };
  }

  // Legacy 3-byte format
  if (data.byteLength === 3) {
    return {
      imuRate: data.getUint8(0),
      fsrRate: 20, // Default
      accelRange: data.getUint8(1),
      gyroRange: data.getUint8(2) * 10,
    };
  }

  console.warn(`Invalid config size: ${data.byteLength}`);
  return null;
}

/**
 * Legacy: Parse config characteristic value (3-byte format)
 */
export function parseConfig(data: DataView): ArduinoIMUConfig | null {
  const config = parseSensorConfig(data);
  if (!config) return null;

  return {
    sampleRate: config.imuRate,
    accelRange: config.accelRange,
    gyroRange: config.gyroRange,
  };
}

/**
 * Create config characteristic value (new 4-byte format)
 */
export function encodeSensorConfig(config: ArduinoSensorConfig): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = Math.min(100, Math.max(50, config.imuRate));
  buffer[1] = Math.min(50, Math.max(10, config.fsrRate));
  buffer[2] = config.accelRange;
  buffer[3] = Math.floor(config.gyroRange / 10);
  return buffer;
}

/**
 * Legacy: Create config characteristic value (3-byte format)
 */
export function encodeConfig(config: ArduinoIMUConfig): Uint8Array {
  const buffer = new Uint8Array(3);
  buffer[0] = Math.min(100, Math.max(50, config.sampleRate));
  buffer[1] = config.accelRange;
  buffer[2] = Math.floor(config.gyroRange / 10);
  return buffer;
}

/**
 * Create control command
 */
export function encodeCommand(command: number): Uint8Array {
  return new Uint8Array([command]);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate packet loss rate from sequence numbers
 */
export function calculatePacketLoss(sequences: number[]): number {
  if (sequences.length < 2) return 0;

  const sorted = [...sequences].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Handle sequence wrap-around (uint16 max = 65535)
  let expectedCount: number;
  if (last >= first) {
    expectedCount = last - first + 1;
  } else {
    expectedCount = (65535 - first) + last + 2;
  }

  const receivedCount = sequences.length;
  const lostCount = Math.max(0, expectedCount - receivedCount);

  return lostCount / expectedCount;
}

/**
 * Convert Arduino IMU sample to session SensorSample format
 */
export function toSensorSample(
  sample: ArduinoIMUSample,
  sessionStartTime: number,
  arduinoStartTime: number = 0
): {
  t: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  orientation: { roll: number; pitch: number; yaw: number };
} {
  const sessionRelativeTime = sample.timestamp - arduinoStartTime;

  return {
    t: sessionRelativeTime,
    accel: sample.accel,
    gyro: sample.gyro,
    orientation: { roll: 0, pitch: 0, yaw: 0 },
  };
}

/**
 * Convert FSR frame to storage format
 */
export function toFSRSample(
  frame: ArduinoFSRFrame,
  sessionStartTime: number
): {
  t: number;
  sequence: number;
  values: number[];
} {
  return {
    t: frame.timestamp - sessionStartTime,
    sequence: frame.frameSequence,
    values: frame.flat,
  };
}
