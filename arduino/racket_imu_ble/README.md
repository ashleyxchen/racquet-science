# RacquetSense - Arduino IMU BLE Firmware

Firmware for the Arduino Nano 33 BLE Sense Rev2 that streams IMU data (accelerometer + gyroscope) over Bluetooth Low Energy.

## Hardware Requirements

- **Arduino Nano 33 BLE Sense Rev2**
  - MCU: nRF52840 (Cortex-M4F, built-in BLE 5.0)
  - IMU: BMI270 (6-axis accelerometer + gyroscope)

## Required Libraries

Install via Arduino IDE Library Manager:

1. **ArduinoBLE** - BLE peripheral functionality
2. **Arduino_BMI270_BMM150** - BMI270 IMU sensor access

## Installation

1. Open Arduino IDE
2. Select board: **Tools > Board > Arduino Mbed OS Nano Boards > Arduino Nano 33 BLE**
3. Open `racket_imu_ble.ino`
4. Install required libraries (see above)
5. Connect Arduino via USB
6. Upload sketch

## BLE Protocol

### Service UUID
```
19B10000-E8F2-537E-4F6C-D104768A1214
```

### Characteristics

| Name | UUID | Properties | Size |
|------|------|------------|------|
| IMU Data | 19B10001-... | Read, Notify | 20 bytes |
| Control | 19B10002-... | Write | 1 byte |
| Config | 19B10003-... | Read, Write | 3 bytes |

### IMU Data Packet (20 bytes, little-endian)

| Bytes | Field | Type | Description |
|-------|-------|------|-------------|
| 0-3 | timestamp_ms | uint32 | Milliseconds since START |
| 4-5 | accel_x | int16 | Raw accelerometer X |
| 6-7 | accel_y | int16 | Raw accelerometer Y |
| 8-9 | accel_z | int16 | Raw accelerometer Z |
| 10-11 | gyro_x | int16 | Raw gyroscope X |
| 12-13 | gyro_y | int16 | Raw gyroscope Y |
| 14-15 | gyro_z | int16 | Raw gyroscope Z |
| 16-17 | sequence | uint16 | Packet sequence number |
| 18-19 | reserved | uint16 | Reserved / status |

### Conversion Formulas

```javascript
// Accelerometer: raw int16 to g (±4g range)
accel_g = raw_value * (4.0 / 32768.0);

// Gyroscope: raw int16 to degrees/second (±2000 dps range)
gyro_dps = raw_value * (2000.0 / 32768.0);
```

### Control Commands

Write to Control characteristic:

| Command | Value | Description |
|---------|-------|-------------|
| START | 0x01 | Begin streaming, reset timestamp to 0 |
| STOP | 0x02 | Stop streaming |
| PING | 0x03 | Request status response |

### Config Characteristic (3 bytes)

| Byte | Field | Values |
|------|-------|--------|
| 0 | sample_rate | 50-100 Hz |
| 1 | accel_range | 2, 4, 8, 16 (g) |
| 2 | gyro_range | 25 (=250 dps), 50, 100, 200 (=2000 dps) |

## LED Indicators

- **Built-in LED (orange)**: On when BLE connected
- **Red LED**: On when streaming data

## Testing with nRF Connect

1. Install nRF Connect app on your phone
2. Power on Arduino (via USB or battery)
3. Scan for "RacquetSense" device
4. Connect
5. Find IMU Service (19B10000-...)
6. Enable notifications on IMU Data characteristic
7. Write 0x01 to Control characteristic to start streaming
8. Observe 20-byte packets arriving at ~100 Hz
9. Write 0x02 to Control characteristic to stop

## Serial Debug

Connect via USB and open Serial Monitor at 115200 baud to see:
- Initialization status
- Connection events
- Streaming statistics (every 100 packets)

## Troubleshooting

### IMU Initialization Failed
- Ensure you're using Arduino Nano 33 BLE Sense **Rev2** (has BMI270)
- Rev1 has a different IMU (LSM9DS1) and needs different library

### BLE Not Advertising
- Reset the Arduino
- Check if another device is connected (only one connection allowed)

### Packets Not Arriving
- Ensure notifications are enabled on IMU Data characteristic
- Send START command (0x01) to Control characteristic
- Check Serial Monitor for errors
