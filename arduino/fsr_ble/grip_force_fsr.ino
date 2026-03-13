// The Solution: Binary Data
// Instead of sending characters, we send the raw bytes of the int values.

// Total Data: 32 sensors × 2 bytes per int = 64 bytes per frame.

// Efficiency: This is roughly 5x faster than the text method.

// Packet Handling: Since the standard BLE limit is 20 bytes, we will split the 64-byte frame into 4 small packets of 16 bytes each.

#include <ArduinoBLE.h>

const int s0 = A4; const int s1 = A3; const int s2 = A2; const int s3 = A1; 
const int w0 = 6;  const int w1 = 5;  const int w2 = 4;  const int w3 = 3; 
const int SIG_pin = A0; const int OUT_pin = 2;  

const byte ROWS = 4; 
const byte COLS = 8; 
const byte TOTAL_SENSORS = ROWS * COLS;

// UART Service
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E"); 
// Set characteristic size to 20 bytes (standard)
BLECharacteristic txCharacteristic("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", BLENotify, 20); 
BLECharacteristic rxCharacteristic("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite, 20); 

unsigned long lastSendTime = 0;
const int sendInterval = 100; // 100ms = 10Hz

int sensorBuffer[ROWS][COLS];

const boolean muxChannel[16][4] = {
  {0,0,0,0},{1,0,0,0},{0,1,0,0},{1,1,0,0},{0,0,1,0},{1,0,1,0},{0,1,1,0},{1,1,1,0},
  {0,0,0,1},{1,0,0,1},{0,1,0,1},{1,1,0,1},{0,0,1,1},{1,0,1,1},{0,1,1,1},{1,1,1,1}
};

void setup() {
  pinMode(s0, OUTPUT); pinMode(s1, OUTPUT); pinMode(s2, OUTPUT); pinMode(s3, OUTPUT);
  pinMode(w0, OUTPUT); pinMode(w1, OUTPUT); pinMode(w2, OUTPUT); pinMode(w3, OUTPUT);
  pinMode(OUT_pin, OUTPUT);
  digitalWrite(OUT_pin, HIGH);

  if (!BLE.begin()) while (1);

  BLE.setLocalName("Matrix_Binary"); 
  BLE.setAdvertisedService(uartService);
  uartService.addCharacteristic(txCharacteristic);
  uartService.addCharacteristic(rxCharacteristic);
  BLE.addService(uartService);
  BLE.advertise();
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    while (central.connected()) {
      scanSensors();
      if (millis() - lastSendTime >= sendInterval) {
        sendBinaryGrid();
        lastSendTime = millis();
      }
    }
  }
}

void scanSensors() {
  for(byte r = 0; r < ROWS; r++) {
    digitalWrite(s0, muxChannel[r][0]);
    digitalWrite(s1, muxChannel[r][1]);
    digitalWrite(s2, muxChannel[r][2]);
    digitalWrite(s3, muxChannel[r][3]);
    for(byte c = 0; c < COLS; c++) {
      digitalWrite(w0, muxChannel[c][0]);
      digitalWrite(w1, muxChannel[c][1]);
      digitalWrite(w2, muxChannel[c][2]);
      digitalWrite(w3, muxChannel[c][3]);
      delayMicroseconds(10); 
      sensorBuffer[r][c] = analogRead(SIG_pin); 
    }
  }
}

void sendBinaryGrid() {
  if (!txCharacteristic.subscribed()) return;

  uint8_t outputBuffer[64]; // 32 sensors * 2 bytes (int)
  int index = 0;

  // Flatten the 2D array into a 1D byte array
  for(byte r = 0; r < ROWS; r++) {
    for(byte c = 0; c < COLS; c++) {
      outputBuffer[index++] = lowByte(sensorBuffer[r][c]);
      outputBuffer[index++] = highByte(sensorBuffer[r][c]);
    }
  }

  // Split 64 bytes into 4 packets of 16 bytes each
  for (int i = 0; i < 4; i++) {
    txCharacteristic.writeValue(&outputBuffer[i * 16], 16);
    delay(5); // Small breather for the radio
  }
}