/**
 * RacquetSense - Arduino Nano 33 BLE Sense Rev2 IMU BLE Firmware
 *
 * Streams accelerometer and gyroscope data from the BMI270 IMU sensor
 * to a connected iOS device via Bluetooth Low Energy (BLE).
 *
 * Hardware: Arduino Nano 33 BLE Sense Rev2
 * - MCU: nRF52840 (Cortex-M4F, built-in BLE 5.0)
 * - IMU: BMI270 (6-axis: accelerometer + gyroscope)
 *
 * BLE Protocol:
 * - Service UUID: 19B10000-E8F2-537E-4F6C-D104768A1214
 * - IMU Data Characteristic: 19B10001-... (Notify, 20 bytes)
 * - Control Characteristic: 19B10002-... (Write, 1 byte)
 * - Config Characteristic: 19B10003-... (Read/Write, 3 bytes)
 *
 * Data Packet Format (20 bytes, little-endian):
 * - Bytes 0-3:   timestamp_ms (uint32) - ms since START command
 * - Bytes 4-5:   accel_x (int16) - raw value (±32767 = ±4g)
 * - Bytes 6-7:   accel_y (int16)
 * - Bytes 8-9:   accel_z (int16)
 * - Bytes 10-11: gyro_x (int16) - raw value (±32767 = ±2000 dps)
 * - Bytes 12-13: gyro_y (int16)
 * - Bytes 14-15: gyro_z (int16)
 * - Bytes 16-17: sequence (uint16) - packet sequence number
 * - Bytes 18-19: reserved (uint16)
 *
 * Control Commands:
 * - 0x01: START - Begin streaming, reset timestamp
 * - 0x02: STOP  - Stop streaming
 * - 0x03: PING  - Status check (responds via notification)
 */

#include <ArduinoBLE.h>
#include <Arduino_BMI270_BMM150.h>

// ============================================================================
// BLE Service & Characteristic UUIDs
// ============================================================================
#define IMU_SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define IMU_DATA_CHAR_UUID      "19B10001-E8F2-537E-4F6C-D104768A1214"
#define CONTROL_CHAR_UUID       "19B10002-E8F2-537E-4F6C-D104768A1214"
#define CONFIG_CHAR_UUID        "19B10003-E8F2-537E-4F6C-D104768A1214"

// ============================================================================
// Control Commands
// ============================================================================
#define CMD_START   0x01
#define CMD_STOP    0x02
#define CMD_PING    0x03

// ============================================================================
// Configuration
// ============================================================================
#define DEVICE_NAME           "RacquetSense"
#define SAMPLE_RATE_HZ        100   // Target sample rate
#define SAMPLE_INTERVAL_US    (1000000 / SAMPLE_RATE_HZ)  // Microseconds between samples

// IMU ranges (BMI270 defaults via Arduino library)
// Accelerometer: ±4g (configurable: 2, 4, 8, 16)
// Gyroscope: ±2000 dps (configurable: 125, 250, 500, 1000, 2000)
#define ACCEL_RANGE_G         4.0f
#define GYRO_RANGE_DPS        2000.0f

// Scaling factors for int16 encoding
// Convert float to int16: raw = value * SCALE
// Convert int16 to float: value = raw / SCALE
#define ACCEL_SCALE           (32768.0f / ACCEL_RANGE_G)    // 8192.0
#define GYRO_SCALE            (32768.0f / GYRO_RANGE_DPS)   // 16.384

// ============================================================================
// BLE Service and Characteristics
// ============================================================================
BLEService imuService(IMU_SERVICE_UUID);

// IMU Data: 20 bytes, read + notify
BLECharacteristic imuDataChar(IMU_DATA_CHAR_UUID, BLERead | BLENotify, 20);

// Control: 1 byte, write
BLECharacteristic controlChar(CONTROL_CHAR_UUID, BLEWrite, 1);

// Config: 3 bytes (sample_rate, accel_range, gyro_range)
uint8_t configData[3] = { 100, 4, 200 };  // 100Hz, ±4g, ±2000dps (200 = 2000/10)
BLECharacteristic configChar(CONFIG_CHAR_UUID, BLERead | BLEWrite, 3);

// ============================================================================
// State Variables
// ============================================================================
bool isStreaming = false;
uint32_t streamStartTime = 0;
uint16_t sequenceNum = 0;
unsigned long lastSampleTime = 0;

// LED indicators
#define LED_CONNECTED    LED_BUILTIN
#define LED_STREAMING    LEDR  // Red LED for streaming

// ============================================================================
// Data Packet Buffer
// ============================================================================
uint8_t packet[20];

// ============================================================================
// Setup
// ============================================================================
void setup() {
  // Initialize serial for debugging
  Serial.begin(115200);
  // Don't wait for serial - allows standalone operation
  delay(1000);

  Serial.println("RacquetSense - IMU BLE Firmware");
  Serial.println("================================");

  // Initialize LEDs
  pinMode(LED_CONNECTED, OUTPUT);
  pinMode(LED_STREAMING, OUTPUT);
  digitalWrite(LED_CONNECTED, HIGH);  // LED off (active low)
  digitalWrite(LED_STREAMING, HIGH);  // LED off (active low)

  // Initialize IMU
  Serial.print("Initializing IMU... ");
  if (!IMU.begin()) {
    Serial.println("FAILED!");
    Serial.println("Check IMU wiring or board compatibility.");
    while (1) {
      // Blink LED rapidly to indicate error
      digitalWrite(LED_STREAMING, LOW);
      delay(100);
      digitalWrite(LED_STREAMING, HIGH);
      delay(100);
    }
  }
  Serial.println("OK");

  // Print IMU info
  Serial.print("  Accelerometer sample rate: ");
  Serial.print(IMU.accelerationSampleRate());
  Serial.println(" Hz");
  Serial.print("  Gyroscope sample rate: ");
  Serial.print(IMU.gyroscopeSampleRate());
  Serial.println(" Hz");

  // Initialize BLE
  Serial.print("Initializing BLE... ");
  if (!BLE.begin()) {
    Serial.println("FAILED!");
    while (1) {
      digitalWrite(LED_STREAMING, LOW);
      delay(200);
      digitalWrite(LED_STREAMING, HIGH);
      delay(200);
    }
  }
  Serial.println("OK");

  // Configure BLE
  BLE.setLocalName(DEVICE_NAME);
  BLE.setDeviceName(DEVICE_NAME);  // Also set the GAP device name
  BLE.setAdvertisedService(imuService);

  // Add characteristics to service
  imuService.addCharacteristic(imuDataChar);
  imuService.addCharacteristic(controlChar);
  imuService.addCharacteristic(configChar);

  // Add service
  BLE.addService(imuService);

  // Set initial values
  configChar.writeValue(configData, 3);

  // Start advertising
  BLE.advertise();

  Serial.println("Ready!");
  Serial.print("Device name: ");
  Serial.println(DEVICE_NAME);
  Serial.print("MAC address: ");
  Serial.println(BLE.address());
  Serial.println("Waiting for connection...");
}

// ============================================================================
// Main Loop
// ============================================================================
void loop() {
  // Poll for BLE events
  BLE.poll();

  // Check for central connection
  BLEDevice central = BLE.central();

  if (central) {
    // Connected
    digitalWrite(LED_CONNECTED, LOW);  // LED on (active low)

    Serial.print("Connected to: ");
    Serial.println(central.address());

    // Handle connection
    while (central.connected()) {
      BLE.poll();

      // Check for control commands
      if (controlChar.written()) {
        handleControlCommand();
      }

      // Check for config updates
      if (configChar.written()) {
        handleConfigUpdate();
      }

      // Stream IMU data if active
      if (isStreaming) {
        streamIMUData();
      }
    }

    // Disconnected
    Serial.println("Disconnected");
    digitalWrite(LED_CONNECTED, HIGH);  // LED off
    stopStreaming();
  }
}

// ============================================================================
// Control Command Handler
// ============================================================================
void handleControlCommand() {
  uint8_t cmd = controlChar.value()[0];

  switch (cmd) {
    case CMD_START:
      startStreaming();
      break;

    case CMD_STOP:
      stopStreaming();
      break;

    case CMD_PING:
      sendPingResponse();
      break;

    default:
      Serial.print("Unknown command: 0x");
      Serial.println(cmd, HEX);
  }
}

// ============================================================================
// Config Update Handler
// ============================================================================
void handleConfigUpdate() {
  const uint8_t* newConfig = configChar.value();

  Serial.println("Config update received:");
  Serial.print("  Sample rate: ");
  Serial.print(newConfig[0]);
  Serial.println(" Hz");
  Serial.print("  Accel range: ±");
  Serial.print(newConfig[1]);
  Serial.println(" g");
  Serial.print("  Gyro range: ±");
  Serial.print(newConfig[2] * 10);
  Serial.println(" dps");

  // Store config (actual IMU configuration would require library modifications)
  configData[0] = newConfig[0];
  configData[1] = newConfig[1];
  configData[2] = newConfig[2];
}

// ============================================================================
// Streaming Control
// ============================================================================
void startStreaming() {
  if (isStreaming) return;

  Serial.println("Starting IMU streaming...");

  isStreaming = true;
  streamStartTime = millis();
  sequenceNum = 0;
  lastSampleTime = micros();

  digitalWrite(LED_STREAMING, LOW);  // LED on (active low)
}

void stopStreaming() {
  if (!isStreaming) return;

  Serial.println("Stopping IMU streaming");
  Serial.print("  Total packets sent: ");
  Serial.println(sequenceNum);

  isStreaming = false;
  digitalWrite(LED_STREAMING, HIGH);  // LED off
}

// ============================================================================
// IMU Data Streaming
// ============================================================================
void streamIMUData() {
  unsigned long now = micros();

  // Check if it's time for next sample
  if (now - lastSampleTime < SAMPLE_INTERVAL_US) {
    return;
  }

  lastSampleTime = now;

  // Check if IMU data is available
  if (!IMU.accelerationAvailable() || !IMU.gyroscopeAvailable()) {
    return;
  }

  // Read IMU data
  float ax, ay, az;  // Accelerometer (g)
  float gx, gy, gz;  // Gyroscope (degrees/second)

  IMU.readAcceleration(ax, ay, az);
  IMU.readGyroscope(gx, gy, gz);

  // Calculate timestamp (ms since start)
  uint32_t timestamp = millis() - streamStartTime;

  // Convert to scaled int16 values
  int16_t accelX = (int16_t)(ax * ACCEL_SCALE);
  int16_t accelY = (int16_t)(ay * ACCEL_SCALE);
  int16_t accelZ = (int16_t)(az * ACCEL_SCALE);
  int16_t gyroX = (int16_t)(gx * GYRO_SCALE);
  int16_t gyroY = (int16_t)(gy * GYRO_SCALE);
  int16_t gyroZ = (int16_t)(gz * GYRO_SCALE);

  // Pack data into packet (little-endian)
  // Bytes 0-3: timestamp (uint32)
  packet[0] = (timestamp) & 0xFF;
  packet[1] = (timestamp >> 8) & 0xFF;
  packet[2] = (timestamp >> 16) & 0xFF;
  packet[3] = (timestamp >> 24) & 0xFF;

  // Bytes 4-5: accel_x (int16)
  packet[4] = accelX & 0xFF;
  packet[5] = (accelX >> 8) & 0xFF;

  // Bytes 6-7: accel_y (int16)
  packet[6] = accelY & 0xFF;
  packet[7] = (accelY >> 8) & 0xFF;

  // Bytes 8-9: accel_z (int16)
  packet[8] = accelZ & 0xFF;
  packet[9] = (accelZ >> 8) & 0xFF;

  // Bytes 10-11: gyro_x (int16)
  packet[10] = gyroX & 0xFF;
  packet[11] = (gyroX >> 8) & 0xFF;

  // Bytes 12-13: gyro_y (int16)
  packet[12] = gyroY & 0xFF;
  packet[13] = (gyroY >> 8) & 0xFF;

  // Bytes 14-15: gyro_z (int16)
  packet[14] = gyroZ & 0xFF;
  packet[15] = (gyroZ >> 8) & 0xFF;

  // Bytes 16-17: sequence number (uint16)
  packet[16] = sequenceNum & 0xFF;
  packet[17] = (sequenceNum >> 8) & 0xFF;

  // Bytes 18-19: reserved
  packet[18] = 0;
  packet[19] = 0;

  // Send via BLE notification
  imuDataChar.writeValue(packet, 20);

  sequenceNum++;

  // Debug output (throttled)
  if (sequenceNum % 100 == 0) {
    Serial.print("Packet ");
    Serial.print(sequenceNum);
    Serial.print(" | t=");
    Serial.print(timestamp);
    Serial.print("ms | accel=(");
    Serial.print(ax, 2);
    Serial.print(", ");
    Serial.print(ay, 2);
    Serial.print(", ");
    Serial.print(az, 2);
    Serial.print(")g | gyro=(");
    Serial.print(gx, 1);
    Serial.print(", ");
    Serial.print(gy, 1);
    Serial.print(", ");
    Serial.print(gz, 1);
    Serial.println(")dps");
  }
}

// ============================================================================
// Ping Response
// ============================================================================
void sendPingResponse() {
  Serial.println("Ping received, sending status...");

  // Send a status packet (all zeros except sequence = 0xFFFF to indicate status)
  memset(packet, 0, 20);
  packet[16] = 0xFF;
  packet[17] = 0xFF;

  // Byte 18: streaming status (1 = streaming, 0 = stopped)
  packet[18] = isStreaming ? 1 : 0;

  // Byte 19: battery level placeholder (0-100)
  packet[19] = 100;  // TODO: Add actual battery reading if available

  imuDataChar.writeValue(packet, 20);
}
