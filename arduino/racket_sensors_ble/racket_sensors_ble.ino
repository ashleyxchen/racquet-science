/**
 * RacquetSense Combined Sensor Firmware
 * Arduino Nano 33 BLE Sense Rev2 + FSR Grid
 *
 * Streams both IMU (accelerometer + gyroscope) and FSR pressure grid data
 * to a connected iOS device via Bluetooth Low Energy (BLE).
 *
 * Hardware:
 * - Arduino Nano 33 BLE Sense Rev2 (nRF52840 + BMI270 IMU)
 * - 4x8 FSR grid via two 16-channel analog multiplexers
 *
 * ============================================================================
 * BLE Protocol Design
 * ============================================================================
 *
 * Service UUID: 19B10000-E8F2-537E-4F6C-D104768A1214
 *
 * Characteristics:
 * - Sensor Data (Notify):  19B10001-... (20 bytes max)
 * - Control (Write):       19B10002-... (1 byte)
 * - Config (Read/Write):   19B10003-... (4 bytes)
 *
 * ============================================================================
 * Packet Formats (all little-endian)
 * ============================================================================
 *
 * All packets start with a 1-byte type header:
 *   0x01 = IMU data
 *   0x02 = FSR data
 *   0x03 = Status response
 *
 * --- IMU Packet (20 bytes) @ 100Hz ---
 * Byte  | Field      | Type   | Description
 * ------|------------|--------|----------------------------------
 * 0     | type       | uint8  | 0x01
 * 1-4   | timestamp  | uint32 | ms since START
 * 5-6   | accel_x    | int16  | ±32767 = ±4g
 * 7-8   | accel_y    | int16  |
 * 9-10  | accel_z    | int16  |
 * 11-12 | gyro_x     | int16  | ±32767 = ±2000 dps
 * 13-14 | gyro_y     | int16  |
 * 15-16 | gyro_z     | int16  |
 * 17-18 | sequence   | uint16 | IMU packet sequence
 * 19    | reserved   | uint8  | 0
 *
 * --- FSR Packet (20 bytes) @ 100Hz, 2 packets per frame (8-bit packed) ---
 * Byte  | Field      | Type    | Description
 * ------|------------|---------|----------------------------------
 * 0     | type       | uint8   | 0x02
 * 1-2   | frame_seq  | uint16  | FSR frame sequence
 * 3     | chunk_idx  | uint8   | 0-1 (which 16 sensors)
 * 4-19  | data       | uint8×16| 16 sensor values (8-bit, scaled from 10-bit ADC)
 *
 * 8-bit scaling: ADC value (0-1023) >> 2 = 0-255
 * To reconstruct: value << 2 (multiply by 4)
 *
 * FSR Grid Layout (4 rows × 8 cols = 32 sensors):
 *   Chunk 0: Sensors 0-15  (Rows 0-1)
 *   Chunk 1: Sensors 16-31 (Rows 2-3)
 *
 * --- Status Packet (20 bytes) ---
 * Byte  | Field      | Type   | Description
 * ------|------------|--------|----------------------------------
 * 0     | type       | uint8  | 0x03
 * 1-4   | timestamp  | uint32 | ms since START (0 if not streaming)
 * 5     | streaming  | uint8  | Bit flags: 0x01=IMU, 0x02=FSR
 * 6     | battery    | uint8  | 0-100 (placeholder)
 * 7-8   | imu_seq    | uint16 | Current IMU sequence
 * 9-10  | fsr_seq    | uint16 | Current FSR frame sequence
 * 11-19 | reserved   | uint8×9| 0
 *
 * ============================================================================
 * Control Commands (1 byte)
 * ============================================================================
 * 0x01 = START_ALL    - Start both IMU and FSR streaming
 * 0x02 = STOP_ALL     - Stop both
 * 0x03 = PING         - Request status packet
 * 0x11 = START_IMU    - Start IMU only
 * 0x12 = STOP_IMU     - Stop IMU only
 * 0x21 = START_FSR    - Start FSR only
 * 0x22 = STOP_FSR     - Stop FSR only
 *
 * ============================================================================
 * Config (4 bytes, Read/Write)
 * ============================================================================
 * Byte 0: IMU sample rate (50 or 100 Hz)
 * Byte 1: FSR sample rate (10, 20, or 50 Hz)
 * Byte 2: Accelerometer range (2, 4, 8, or 16 g)
 * Byte 3: Gyroscope range / 10 (25=250dps, 50=500, 100=1000, 200=2000)
 */

#include <ArduinoBLE.h>
#include <Arduino_BMI270_BMM150.h>

// ============================================================================
// BLE UUIDs
// ============================================================================
#define SERVICE_UUID           "19B10000-E8F2-537E-4F6C-D104768A1214"
#define SENSOR_DATA_CHAR_UUID  "19B10001-E8F2-537E-4F6C-D104768A1214"
#define CONTROL_CHAR_UUID      "19B10002-E8F2-537E-4F6C-D104768A1214"
#define CONFIG_CHAR_UUID       "19B10003-E8F2-537E-4F6C-D104768A1214"

// ============================================================================
// Packet Types
// ============================================================================
#define PKT_TYPE_IMU     0x01
#define PKT_TYPE_FSR     0x02
#define PKT_TYPE_STATUS  0x03

// ============================================================================
// Control Commands
// ============================================================================
#define CMD_START_ALL    0x01
#define CMD_STOP_ALL     0x02
#define CMD_PING         0x03
#define CMD_START_IMU    0x11
#define CMD_STOP_IMU     0x12
#define CMD_START_FSR    0x21
#define CMD_STOP_FSR     0x22

// ============================================================================
// FSR Multiplexer Pins
// ============================================================================
// Row multiplexer select pins (accent which row)
const int MUX_ROW_S0 = A4;
const int MUX_ROW_S1 = A3;
const int MUX_ROW_S2 = A2;
const int MUX_ROW_S3 = A1;

// Column multiplexer select pins (select which column)
const int MUX_COL_S0 = 6;
const int MUX_COL_S1 = 5;
const int MUX_COL_S2 = 4;
const int MUX_COL_S3 = 3;

// Analog input from multiplexer
const int MUX_SIG_PIN = A0;

// Output enable (optional, active low)
const int MUX_OUT_PIN = 2;

// ============================================================================
// FSR Grid Configuration
// ============================================================================
const byte FSR_ROWS = 4;
const byte FSR_COLS = 8;
const byte FSR_TOTAL = FSR_ROWS * FSR_COLS;  // 32 sensors
const byte FSR_CHUNKS = 2;                    // 2 packets per frame (16 sensors each, 8-bit)
const byte FSR_SENSORS_PER_CHUNK = 16;        // 16 sensors per packet

// Multiplexer channel truth table (binary to pin states)
const boolean muxChannel[16][4] = {
  {0,0,0,0}, {1,0,0,0}, {0,1,0,0}, {1,1,0,0},
  {0,0,1,0}, {1,0,1,0}, {0,1,1,0}, {1,1,1,0},
  {0,0,0,1}, {1,0,0,1}, {0,1,0,1}, {1,1,0,1},
  {0,0,1,1}, {1,0,1,1}, {0,1,1,1}, {1,1,1,1}
};

// ============================================================================
// Timing Configuration
// ============================================================================
#define IMU_SAMPLE_RATE_HZ    100
#define FSR_SAMPLE_RATE_HZ    100  // Increased from 20Hz, using 8-bit packed format

#define IMU_INTERVAL_US       (1000000 / IMU_SAMPLE_RATE_HZ)  // 10000 us
#define FSR_INTERVAL_MS       (1000 / FSR_SAMPLE_RATE_HZ)     // 10 ms

// ============================================================================
// IMU Scaling
// ============================================================================
#define ACCEL_RANGE_G         4.0f
#define GYRO_RANGE_DPS        2000.0f
#define ACCEL_SCALE           (32768.0f / ACCEL_RANGE_G)
#define GYRO_SCALE            (32768.0f / GYRO_RANGE_DPS)

// ============================================================================
// BLE Service and Characteristics
// ============================================================================
BLEService sensorService(SERVICE_UUID);
BLECharacteristic sensorDataChar(SENSOR_DATA_CHAR_UUID, BLERead | BLENotify, 20);
BLECharacteristic controlChar(CONTROL_CHAR_UUID, BLEWrite, 1);
BLECharacteristic configChar(CONFIG_CHAR_UUID, BLERead | BLEWrite, 4);

// ============================================================================
// State Variables
// ============================================================================
bool imuStreaming = false;
bool fsrStreaming = false;
uint32_t streamStartTime = 0;

uint16_t imuSequence = 0;
uint16_t fsrFrameSequence = 0;

unsigned long lastImuSampleTime = 0;
unsigned long lastFsrSampleTime = 0;

// Sensor data buffers
int16_t fsrBuffer[FSR_ROWS][FSR_COLS];

// Config data
uint8_t configData[4] = {
  100,   // IMU rate: 100 Hz
  20,    // FSR rate: 20 Hz
  4,     // Accel range: ±4g
  200    // Gyro range: ±2000 dps (200 * 10)
};

// Packet buffer
uint8_t packet[20];

// LED indicators
#define LED_CONNECTED    LED_BUILTIN
#define LED_STREAMING    LEDR

// ============================================================================
// Setup
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("RacquetSense Combined Sensor Firmware");
  Serial.println("======================================");

  // Initialize LEDs
  pinMode(LED_CONNECTED, OUTPUT);
  pinMode(LED_STREAMING, OUTPUT);
  digitalWrite(LED_CONNECTED, HIGH);  // Off (active low)
  digitalWrite(LED_STREAMING, HIGH);

  // Initialize FSR multiplexer pins
  initFSRPins();

  // Initialize IMU
  Serial.print("Initializing IMU... ");
  if (!IMU.begin()) {
    Serial.println("FAILED!");
    errorBlink();
  }
  Serial.println("OK");
  Serial.print("  Accel rate: "); Serial.print(IMU.accelerationSampleRate()); Serial.println(" Hz");
  Serial.print("  Gyro rate:  "); Serial.print(IMU.gyroscopeSampleRate()); Serial.println(" Hz");

  // Initialize BLE
  Serial.print("Initializing BLE... ");
  if (!BLE.begin()) {
    Serial.println("FAILED!");
    errorBlink();
  }
  Serial.println("OK");

  // Configure BLE
  BLE.setLocalName("RacquetSense");
  BLE.setDeviceName("RacquetSense");
  BLE.setAdvertisedService(sensorService);

  sensorService.addCharacteristic(sensorDataChar);
  sensorService.addCharacteristic(controlChar);
  sensorService.addCharacteristic(configChar);
  BLE.addService(sensorService);

  configChar.writeValue(configData, 4);
  BLE.advertise();

  Serial.println("Ready!");
  Serial.print("Device: RacquetSense, MAC: ");
  Serial.println(BLE.address());
  Serial.println("Waiting for connection...");
}

// ============================================================================
// Main Loop
// ============================================================================
void loop() {
  BLE.poll();

  BLEDevice central = BLE.central();

  if (central) {
    digitalWrite(LED_CONNECTED, LOW);  // On
    Serial.print("Connected to: ");
    Serial.println(central.address());

    while (central.connected()) {
      BLE.poll();

      // Handle control commands
      if (controlChar.written()) {
        handleCommand();
      }

      // Handle config updates
      if (configChar.written()) {
        handleConfigUpdate();
      }

      // Stream IMU data
      if (imuStreaming) {
        streamIMU();
      }

      // Stream FSR data
      if (fsrStreaming) {
        streamFSR();
      }
    }

    Serial.println("Disconnected");
    digitalWrite(LED_CONNECTED, HIGH);
    stopAll();
  }
}

// ============================================================================
// FSR Pin Initialization
// ============================================================================
void initFSRPins() {
  pinMode(MUX_ROW_S0, OUTPUT);
  pinMode(MUX_ROW_S1, OUTPUT);
  pinMode(MUX_ROW_S2, OUTPUT);
  pinMode(MUX_ROW_S3, OUTPUT);

  pinMode(MUX_COL_S0, OUTPUT);
  pinMode(MUX_COL_S1, OUTPUT);
  pinMode(MUX_COL_S2, OUTPUT);
  pinMode(MUX_COL_S3, OUTPUT);

  pinMode(MUX_OUT_PIN, OUTPUT);
  digitalWrite(MUX_OUT_PIN, HIGH);  // Enable output
}

// ============================================================================
// Command Handler
// ============================================================================
void handleCommand() {
  uint8_t cmd = controlChar.value()[0];

  switch (cmd) {
    case CMD_START_ALL:
      startIMU();
      startFSR();
      break;
    case CMD_STOP_ALL:
      stopAll();
      break;
    case CMD_PING:
      sendStatus();
      break;
    case CMD_START_IMU:
      startIMU();
      break;
    case CMD_STOP_IMU:
      stopIMU();
      break;
    case CMD_START_FSR:
      startFSR();
      break;
    case CMD_STOP_FSR:
      stopFSR();
      break;
    default:
      Serial.print("Unknown command: 0x");
      Serial.println(cmd, HEX);
  }
}

// ============================================================================
// Config Handler
// ============================================================================
void handleConfigUpdate() {
  const uint8_t* newConfig = configChar.value();
  memcpy(configData, newConfig, 4);

  Serial.println("Config updated:");
  Serial.print("  IMU rate:    "); Serial.print(configData[0]); Serial.println(" Hz");
  Serial.print("  FSR rate:    "); Serial.print(configData[1]); Serial.println(" Hz");
  Serial.print("  Accel range: ±"); Serial.print(configData[2]); Serial.println(" g");
  Serial.print("  Gyro range:  ±"); Serial.print(configData[3] * 10); Serial.println(" dps");
}

// ============================================================================
// Streaming Control
// ============================================================================
void startIMU() {
  if (imuStreaming) return;

  Serial.println("Starting IMU streaming...");
  if (streamStartTime == 0) {
    streamStartTime = millis();
  }
  imuStreaming = true;
  imuSequence = 0;
  lastImuSampleTime = micros();
  updateLED();
}

void stopIMU() {
  if (!imuStreaming) return;

  Serial.print("Stopping IMU. Packets sent: ");
  Serial.println(imuSequence);
  imuStreaming = false;
  updateLED();
}

void startFSR() {
  if (fsrStreaming) return;

  Serial.println("Starting FSR streaming...");
  if (streamStartTime == 0) {
    streamStartTime = millis();
  }
  fsrStreaming = true;
  fsrFrameSequence = 0;
  lastFsrSampleTime = millis();
  updateLED();
}

void stopFSR() {
  if (!fsrStreaming) return;

  Serial.print("Stopping FSR. Frames sent: ");
  Serial.println(fsrFrameSequence);
  fsrStreaming = false;
  updateLED();
}

void stopAll() {
  stopIMU();
  stopFSR();
  streamStartTime = 0;
}

void updateLED() {
  digitalWrite(LED_STREAMING, (imuStreaming || fsrStreaming) ? LOW : HIGH);
}

// ============================================================================
// IMU Streaming
// ============================================================================
void streamIMU() {
  unsigned long now = micros();
  if (now - lastImuSampleTime < IMU_INTERVAL_US) return;
  lastImuSampleTime = now;

  if (!IMU.accelerationAvailable() || !IMU.gyroscopeAvailable()) return;

  float ax, ay, az, gx, gy, gz;
  IMU.readAcceleration(ax, ay, az);
  IMU.readGyroscope(gx, gy, gz);

  uint32_t timestamp = millis() - streamStartTime;

  // Scale to int16
  int16_t accelX = (int16_t)(ax * ACCEL_SCALE);
  int16_t accelY = (int16_t)(ay * ACCEL_SCALE);
  int16_t accelZ = (int16_t)(az * ACCEL_SCALE);
  int16_t gyroX = (int16_t)(gx *  GYRO_SCALE);
  int16_t gyroY = (int16_t)(gy * GYRO_SCALE);
  int16_t gyroZ = (int16_t)(gz * GYRO_SCALE);

  // Build packet
  packet[0] = PKT_TYPE_IMU;

  // Timestamp (bytes 1-4)
  packet[1] = timestamp & 0xFF;
  packet[2] = (timestamp >> 8) & 0xFF;
  packet[3] = (timestamp >> 16) & 0xFF;
  packet[4] = (timestamp >> 24) & 0xFF;

  // Accelerometer (bytes 5-10)
  packet[5] = accelX & 0xFF;
  packet[6] = (accelX >> 8) & 0xFF;
  packet[7] = accelY & 0xFF;
  packet[8] = (accelY >> 8) & 0xFF;
  packet[9] = accelZ & 0xFF;
  packet[10] = (accelZ >> 8) & 0xFF;

  // Gyroscope (bytes 11-16)
  packet[11] = gyroX & 0xFF;
  packet[12] = (gyroX >> 8) & 0xFF;
  packet[13] = gyroY & 0xFF;
  packet[14] = (gyroY >> 8) & 0xFF;
  packet[15] = gyroZ & 0xFF;
  packet[16] = (gyroZ >> 8) & 0xFF;

  // Sequence (bytes 17-18)
  packet[17] = imuSequence & 0xFF;
  packet[18] = (imuSequence >> 8) & 0xFF;

  // Reserved
  packet[19] = 0;

  sensorDataChar.writeValue(packet, 20);
  imuSequence++;

  // Debug output disabled for performance - Serial I/O blocks main loop
  // Uncomment for debugging only:
  // if (imuSequence % 500 == 0) {
  //   Serial.print("IMU #"); Serial.println(imuSequence);
  // }
}

// ============================================================================
// FSR Streaming
// ============================================================================
void streamFSR() {
  unsigned long now = millis();
  if (now - lastFsrSampleTime < FSR_INTERVAL_MS) return;
  lastFsrSampleTime = now;

  // Scan all sensors
  scanFSRGrid();

  // Send 2 packets (16 sensors each, 8-bit packed)
  for (byte chunk = 0; chunk < FSR_CHUNKS; chunk++) {
    sendFSRChunkPacked(chunk);
  }

  fsrFrameSequence++;

  // Debug output disabled for performance - Serial I/O blocks main loop
  // Uncomment for debugging only:
  // if (fsrFrameSequence % 100 == 0) {
  //   Serial.print("FSR #"); Serial.println(fsrFrameSequence);
  // }
}

void scanFSRGrid() {
  for (byte row = 0; row < FSR_ROWS; row++) {
    // Select row
    digitalWrite(MUX_ROW_S0, muxChannel[row][0]);
    digitalWrite(MUX_ROW_S1, muxChannel[row][1]);
    digitalWrite(MUX_ROW_S2, muxChannel[row][2]);
    digitalWrite(MUX_ROW_S3, muxChannel[row][3]);

    for (byte col = 0; col < FSR_COLS; col++) {
      // Select column
      digitalWrite(MUX_COL_S0, muxChannel[col][0]);
      digitalWrite(MUX_COL_S1, muxChannel[col][1]);
      digitalWrite(MUX_COL_S2, muxChannel[col][2]);
      digitalWrite(MUX_COL_S3, muxChannel[col][3]);

      delayMicroseconds(10);  // Settling time
      fsrBuffer[row][col] = analogRead(MUX_SIG_PIN);
    }
  }
}

// Legacy 16-bit format (kept for reference, not used)
// void sendFSRChunk(byte row) { ... }

// New 8-bit packed format: 16 sensors per packet
void sendFSRChunkPacked(byte chunk) {
  packet[0] = PKT_TYPE_FSR;

  // Frame sequence (bytes 1-2)
  packet[1] = fsrFrameSequence & 0xFF;
  packet[2] = (fsrFrameSequence >> 8) & 0xFF;

  // Chunk index (byte 3): 0 = sensors 0-15, 1 = sensors 16-31
  packet[3] = chunk;

  // 16 sensor values as 8-bit (bytes 4-19)
  // Each chunk covers 2 rows (16 sensors)
  byte startRow = chunk * 2;
  for (byte i = 0; i < FSR_SENSORS_PER_CHUNK; i++) {
    byte row = startRow + (i / FSR_COLS);
    byte col = i % FSR_COLS;
    // Scale 10-bit ADC (0-1023) to 8-bit (0-255) by right-shifting 2 bits
    uint8_t val8 = (uint8_t)(fsrBuffer[row][col] >> 2);
    packet[4 + i] = val8;
  }

  sensorDataChar.writeValue(packet, 20);
  // NOTE: No delay needed - BLE stack handles buffering internally on nRF52840
}

// ============================================================================
// Status Response
// ============================================================================
void sendStatus() {
  Serial.println("Sending status...");

  memset(packet, 0, 20);
  packet[0] = PKT_TYPE_STATUS;

  // Timestamp (bytes 1-4)
  if (imuStreaming || fsrStreaming) {
    uint32_t ts = millis() - streamStartTime;
    packet[1] = ts & 0xFF;
    packet[2] = (ts >> 8) & 0xFF;
    packet[3] = (ts >> 16) & 0xFF;
    packet[4] = (ts >> 24) & 0xFF;
  }

  // Streaming flags (byte 5)
  uint8_t flags = 0;
  if (imuStreaming) flags |= 0x01;
  if (fsrStreaming) flags |= 0x02;
  packet[5] = flags;

  // Battery (byte 6)
  packet[6] = 100;  // Placeholder

  // IMU sequence (bytes 7-8)
  packet[7] = imuSequence & 0xFF;
  packet[8] = (imuSequence >> 8) & 0xFF;

  // FSR sequence (bytes 9-10)
  packet[9] = fsrFrameSequence & 0xFF;
  packet[10] = (fsrFrameSequence >> 8) & 0xFF;

  sensorDataChar.writeValue(packet, 20);
}

// ============================================================================
// Error Handler
// ============================================================================
void errorBlink() {
  while (1) {
    digitalWrite(LED_STREAMING, LOW);
    delay(100);
    digitalWrite(LED_STREAMING, HIGH);
    delay(100);
  }
}
