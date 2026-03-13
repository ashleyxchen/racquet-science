# Sensor Recording App

## Project Overview

A cross-platform sensor recording application that collects IMU (accelerometer/gyroscope) data from multiple sources:
- **Apple Watch** - via Watch Connectivity to iOS
- **Arduino Uno** - via BLE to iOS (using `@capacitor-community/bluetooth-le`)

Data is displayed in real-time, stored locally, and synced to a FastAPI backend for historical viewing.

## Architecture

```
Apple Watch ──(Watch Connectivity)──► iOS App (Capacitor/React)
Arduino Uno ──(BLE)─────────────────► iOS App (Capacitor/React)
                                           │
                                           ▼
                                      FastAPI Backend
                                           │
                                           ▼
                                    React Web Dashboard
```

## Tech Stack

### Mobile App (Primary Codebase)
- **Framework**: Capacitor 6+
- **Frontend**: React 18+ with TypeScript
- **BLE Plugin**: `@capacitor-community/bluetooth-le`
- **Styling**: [Tailwind CSS / your choice]
- **Build Tool**: Vite

### watchOS Companion
- **Language**: Swift 5.9+
- **UI**: SwiftUI
- **Frameworks**: WatchConnectivity, CoreMotion, HealthKit

### Arduino Firmware
- **Board**: Arduino Uno with HM-10 BLE module
- **Sensors**: MPU6050 (6-axis IMU)
- **Libraries**: Wire (I2C), SoftwareSerial

### Backend
- **Framework**: FastAPI
- **Database**: SQLite (development), PostgreSQL (production)
- **ORM**: SQLAlchemy 2.0+ (async)

## Directory Structure

```
/
├── src/                    # React/Capacitor app
│   ├── components/
│   ├── services/
│   │   └── ble.ts         # BLE service
│   ├── hooks/
│   └── types/
├── ios/                    # Native iOS project
├── watchos/                # watchOS app (Xcode project)
├── arduino/                # Arduino firmware
│   └── sensor_ble/
│       └── sensor_ble.ino
├── backend/                # FastAPI server
│   └── app/
├── .claude/
│   └── agents/            # Claude Code agents
└── CLAUDE.md              # This file
```

## Data Schema

### SensorDataPoint
```typescript
interface SensorDataPoint {
  timestamp: number;        // Unix timestamp (milliseconds)
  source: 'arduino' | 'watch';
  accelX?: number;          // g (±2g range)
  accelY?: number;
  accelZ?: number;
  gyroX?: number;           // degrees/second
  gyroY?: number;
  gyroZ?: number;
  heartRate?: number;       // BPM (watch only)
}
```

### Recording
```typescript
interface Recording {
  id: string;
  name?: string;
  startedAt: number;        // Unix timestamp
  endedAt?: number;
  dataPoints: SensorDataPoint[];
}
```

## BLE Protocol

### Service UUIDs
```
IMU Service:        [TODO: Generate UUID]
IMU Data Char:      [TODO: Generate UUID]  (Notify)
Control Char:       [TODO: Generate UUID]  (Write)
```

### Data Packet Format (16 bytes, big-endian)
```
[0-3]   timestamp (uint32, ms since recording start)
[4-5]   accel_x (int16, raw ADC)
[6-7]   accel_y (int16, raw ADC)
[8-9]   accel_z (int16, raw ADC)
[10-11] gyro_x (int16, raw ADC)
[12-13] gyro_y (int16, raw ADC)
[14-15] gyro_z (int16, raw ADC)
```

### Conversion (MPU6050 defaults)
- Accelerometer: `raw / 16384.0 = g`
- Gyroscope: `raw / 131.0 = degrees/second`

## Timestamp Synchronization

Watch and Arduino have independent clocks. Strategy:
1. iOS sends START command to both devices
2. iOS records `startTime = Date.now()`
3. Each device reports relative time since START
4. iOS converts to absolute: `startTime + relativeMs`

## API Endpoints

```
POST /api/recordings/sync     # Upload recording from mobile
GET  /api/recordings          # List all recordings
GET  /api/recordings/{id}     # Get recording details
GET  /api/recordings/{id}/data # Get sensor data
```

## Code Conventions

### TypeScript/React
- Functional components with hooks
- TypeScript strict mode
- No `any` types
- Async/await for all async operations

### Swift
- SwiftUI for all new views
- Combine or async/await for async
- `[weak self]` in closures

### Arduino
- No heap allocation (avoid `String`)
- Use `millis()` for timing
- Document byte formats in comments

### Python/FastAPI
- Async endpoints
- Pydantic for validation
- Type hints everywhere

## Current Status

### Completed
- [ ] Project structure setup
- [ ] BLE service UUIDs defined

### In Progress
- [ ] [Current work item]

### Next Up
- [ ] [Next planned item]

## Development Commands

```bash
# Mobile app
npm run dev               # Web development
npm run build            # Production build
npx cap sync ios         # Sync to iOS

# Backend
cd backend
uvicorn app.main:app --reload

# Arduino
# Open arduino/sensor_ble/sensor_ble.ino in Arduino IDE
```

## Testing Notes

- BLE does NOT work in iOS Simulator - use real device
- Watch app requires paired iPhone with companion app
- Arduino requires physical hardware connection

## Known Issues

- [List any known issues or limitations]

## Agent Notes

Claude Code agents are configured in `.claude/agents/`:
- `capacitor-react` - React/Capacitor/BLE code
- `watchos` - Swift/watchOS code
- `arduino` - Arduino firmware
- `backend` - FastAPI backend
- `architect` - Cross-cutting concerns, data flow

Use agents explicitly: "Use the arduino agent to..." or let Claude delegate automatically.
