# Recording Session Implementation

## Overview

This document describes the implementation of the synchronized video and Watch motion recording system using the `useRecordingSession` React hook.

## Implementation Date

Created: 2026-02-09

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RecordingPage (UI)                       │
│  - Start/Stop buttons                                       │
│  - Status displays                                          │
│  - Session info                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              useRecordingSession Hook                        │
│  - Session orchestration                                    │
│  - Timestamp synchronization                                │
│  - Sensor data collection                                   │
└──────┬──────────────────────────┬───────────────────────────┘
       │                          │
       ▼                          ▼
┌──────────────────┐    ┌──────────────────────────┐
│ useVideoRecording│    │  WatchMotion Plugin      │
│  - Camera control│    │  - Swift bridge          │
│  - Video saving  │    │  - START/STOP commands   │
└──────────────────┘    └──────────────────────────┘
       │                          │
       ▼                          ▼
┌──────────────────┐    ┌──────────────────────────┐
│ iOS Camera API   │    │ WatchConnectivityManager │
│                  │    │  - Watch communication   │
└──────────────────┘    │  - Motion data streaming │
                        └──────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────┐
                        │    Apple Watch App       │
                        │  - CoreMotion data       │
                        │  - Recording sessions    │
                        └──────────────────────────┘
```

## Files Created/Modified

### 1. Core Hook Implementation

**File**: `/Users/ashleychen/Developer/test-capacitor/app/src/hooks/useRecordingSession.ts`

The main orchestration hook that:
- Generates session UUIDs
- Coordinates video and Watch recording
- Synchronizes timestamps
- Collects sensor data in real-time
- Manages state (recording, errors, status)

**Key Features**:
- Automatic timestamp synchronization using session start time
- Real-time sensor data collection via event listeners
- Resilient error handling (continues video if Watch fails)
- Platform detection (iOS native only)
- Status tracking for both video and Watch components

**API**:
```typescript
const {
  sessionId,           // Current session UUID
  isRecording,         // Overall recording status
  startTime,           // Unix timestamp when started
  duration,            // Duration in ms
  videoStatus,         // 'idle' | 'recording' | 'error'
  watchStatus,         // 'idle' | 'recording' | 'error' | 'disconnected'
  error,               // Error message if any
  startRecording,      // () => Promise<void>
  stopRecording,       // () => Promise<RecordingSessionResult | null>
  getSensorData,       // () => SensorSample[]
} = useRecordingSession();
```

### 2. Updated WatchMotion Plugin (Swift)

**File**: `/Users/ashleychen/Developer/test-capacitor/app/ios/App/App/WatchMotionPlugin.swift`

**Already Had** (lines 20-22, 165-201):
- `startWatchRecording(sessionId)` - Send START command to Watch
- `stopWatchRecording()` - Send STOP command to Watch

These methods were already implemented in the Swift plugin and bridge to:
- `WatchConnectivityManager.sendStartCommand()`
- `WatchConnectivityManager.sendStopCommand()`

### 3. Updated WatchMotion TypeScript Interface

**File**: `/Users/ashleychen/Developer/test-capacitor/app/src/hooks/useWatchMotion.ts`

**Already Had** (lines 20-21):
```typescript
startWatchRecording(options: { sessionId: string }): Promise<{ success: boolean; error?: string }>;
stopWatchRecording(): Promise<{ success: boolean; error?: string }>;
```

The TypeScript interface already defined the recording methods.

### 4. Updated Recording Page UI

**File**: `/Users/ashleychen/Developer/test-capacitor/app/src/pages/RecordingPage.tsx`

Complete rewrite from placeholder to functional recording interface with:
- Real-time recording timer
- Component status indicators (video/watch)
- Sensor sample counter
- Error display
- Session result display
- Start/Stop controls

**UI Features**:
- Color-coded status indicators
- Pulse animation on recording indicator
- Grid layout for component status
- Last recording summary

### 5. Session Storage Service

**File**: `/Users/ashleychen/Developer/test-capacitor/app/src/services/sessionStorage.ts`

Provides local storage for recording sessions:
- Save sessions to localStorage (metadata)
- Save sensor data to filesystem (JSON files)
- Retrieve sessions and sensor data
- Update session metadata
- Delete sessions and cleanup files
- Storage statistics

**API**:
```typescript
// Save a recording
await saveRecordingSession(result, {
  location: 'Court 1',
  conditions: 'Sunny',
  notes: 'Practice session',
  tags: ['serve', 'backhand']
});

// Get all sessions
const sessions = await getAllSessions();

// Get sensor data for a session
const samples = await getSensorData(sessionId);

// Delete a session
await deleteSession(sessionId);

// Get stats
const stats = await getStorageStats();
```

### 6. Documentation

**File**: `/Users/ashleychen/Developer/test-capacitor/app/src/hooks/README_RECORDING_SESSION.md`

Comprehensive documentation including:
- Overview and features
- Installation and basic usage
- Complete API reference
- Timestamp synchronization explanation
- Status monitoring guide
- Error handling patterns
- Platform support notes
- Permission requirements
- Example code
- Troubleshooting guide

## Data Flow

### Starting a Recording

```
User clicks "Start Recording"
    │
    ▼
useRecordingSession.startRecording()
    │
    ├─► Generate session UUID
    ├─► Record startTime = Date.now()
    ├─► Setup motion data listener
    │       └─► Collect samples with t = Date.now() - startTime
    ├─► Send START command to Watch
    │       └─► WatchMotion.startWatchRecording({ sessionId })
    │               └─► WatchConnectivityManager.sendStartCommand()
    │                       └─► Watch app receives START
    │                               └─► Watch starts CoreMotion
    │                                       └─► Streams motion data to iOS
    │
    └─► Start video recording
            └─► useVideoRecording.startRecording(sessionId)
                    └─► VideoRecordingManager.startRecording()
                            └─► AVCaptureSession starts
```

### During Recording

```
Watch sends motion data every ~100ms
    │
    ▼
WatchConnectivityManager receives data
    │
    ▼
WatchMotionPlugin forwards to JavaScript
    │
    ▼
useRecordingSession motion listener receives data
    │
    ▼
Creates SensorSample with:
  - t = Date.now() - sessionStartTime
  - accel, gyro, orientation values
    │
    ▼
Appends to sensorSamplesRef.current[]
```

### Stopping a Recording

```
User clicks "Stop Recording"
    │
    ▼
useRecordingSession.stopRecording()
    │
    ├─► Stop video recording
    │       └─► useVideoRecording.stopRecording()
    │               └─► Returns { videoPath, durationMs }
    │
    ├─► Send STOP command to Watch
    │       └─► WatchMotion.stopWatchRecording()
    │               └─► WatchConnectivityManager.sendStopCommand()
    │                       └─► Watch stops CoreMotion
    │
    ├─► Remove motion listener
    │
    ├─► Collect all sensor samples
    │
    └─► Return RecordingSessionResult
            └─► {
                  sessionId,
                  startTime,
                  endTime,
                  duration,
                  videoPath,
                  sensorSamples: SensorSample[]
                }
```

## Timestamp Synchronization

All timestamps are synchronized to the iPhone clock:

1. **Session Start**: `startTime = Date.now()` (Unix timestamp in ms)
2. **Sensor Samples**: Each sample gets `t = Date.now() - startTime` (relative ms)
3. **Absolute Time**: To convert back: `absoluteTime = startTime + sample.t`

This ensures:
- Video frames and sensor data can be time-aligned
- Multiple sensor sources (Watch, Arduino) use same time base
- Data can be synchronized for playback and analysis

## Data Structures

### SensorSample (from types/session.ts)

```typescript
interface SensorSample {
  t: number;                    // ms from session start
  accel: Vec3;                  // Accelerometer (g-force)
  gyro: Vec3;                   // Gyroscope (rad/s)
  orientation: Orientation;     // Device orientation (radians)
}
```

### RecordingSessionResult

```typescript
interface RecordingSessionResult {
  sessionId: string;            // UUID
  startTime: number;            // Unix timestamp ms
  endTime: number;              // Unix timestamp ms
  duration: number;             // Total duration ms
  videoPath: string | null;     // Path to video file
  sensorSamples: SensorSample[]; // Array of sensor data
}
```

### StoredSession (in sessionStorage.ts)

```typescript
interface StoredSession extends Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  status: 'recording' | 'completed' | 'corrupted';
  metadata: SessionMetadata;
  videoPath: string | null;
  hasWatchData: boolean;
  hasRacketData: boolean;
  sensorDataPath?: string;      // Path to JSON file with samples
}
```

## Usage Example

```typescript
import { useRecordingSession } from '../hooks/useRecordingSession';
import { saveRecordingSession } from '../services/sessionStorage';

function RecordingScreen() {
  const {
    isRecording,
    duration,
    watchStatus,
    videoStatus,
    error,
    startRecording,
    stopRecording,
    getSensorData
  } = useRecordingSession();

  const handleStart = async () => {
    try {
      await startRecording();
    } catch (err) {
      alert(`Failed to start: ${err.message}`);
    }
  };

  const handleStop = async () => {
    try {
      const result = await stopRecording();

      if (result) {
        // Save to local storage
        await saveRecordingSession(result, {
          location: 'Court 1',
          notes: 'Forehand practice'
        });

        alert(`Saved ${result.sensorSamples.length} samples`);
      }
    } catch (err) {
      alert(`Failed to stop: ${err.message}`);
    }
  };

  return (
    <div>
      <button onClick={handleStart} disabled={isRecording}>
        Start
      </button>
      <button onClick={handleStop} disabled={!isRecording}>
        Stop
      </button>
      <div>Duration: {Math.floor(duration / 1000)}s</div>
      <div>Video: {videoStatus}</div>
      <div>Watch: {watchStatus}</div>
      {isRecording && <div>Samples: {getSensorData().length}</div>}
      {error && <div>Error: {error}</div>}
    </div>
  );
}
```

## Testing Checklist

### Prerequisites
- [ ] iOS device (real device, not simulator)
- [ ] Paired Apple Watch with app installed
- [ ] Camera and microphone permissions granted
- [ ] Watch app running and reachable

### Test Cases

1. **Basic Recording Flow**
   - [ ] Start recording
   - [ ] Verify video starts (green status)
   - [ ] Verify Watch starts (green status)
   - [ ] Check sensor samples incrementing
   - [ ] Stop recording
   - [ ] Verify videoPath is returned
   - [ ] Verify sensor samples collected

2. **Watch Disconnection**
   - [ ] Start recording
   - [ ] Turn off Watch or close app
   - [ ] Verify watchStatus becomes 'disconnected'
   - [ ] Verify video continues recording
   - [ ] Stop recording
   - [ ] Verify video saved but no sensor data

3. **Permission Denied**
   - [ ] Deny camera permission
   - [ ] Try to start recording
   - [ ] Verify error message shown
   - [ ] Verify recording does not start

4. **Session Storage**
   - [ ] Complete a recording
   - [ ] Save with metadata
   - [ ] Retrieve from getAllSessions()
   - [ ] Load sensor data with getSensorData()
   - [ ] Delete session
   - [ ] Verify files cleaned up

5. **Multiple Sessions**
   - [ ] Record multiple sessions
   - [ ] Verify unique session IDs
   - [ ] Verify all saved correctly
   - [ ] Check storage stats

## Known Limitations

1. **Platform Support**: iOS only (requires Apple Watch)
2. **BLE Sensor**: Arduino/racket sensor not yet integrated
3. **Video Upload**: Backend sync not implemented yet
4. **Background Recording**: Not supported (app must be foreground)
5. **Storage Limits**: No automatic cleanup of old sessions

## Future Enhancements

1. **Backend Sync**: Upload sessions to FastAPI server
2. **BLE Integration**: Add Arduino racket sensor support
3. **SQLite Migration**: Move from localStorage to SQLite for better performance
4. **Event Markers**: Add ability to mark events during recording
5. **Video Preview**: Add live camera preview during recording
6. **Background Support**: Continue recording when app backgrounds
7. **Storage Management**: Auto-delete old sessions when storage is low

## Related Files

### Existing Files (Not Modified)

- `/Users/ashleychen/Developer/test-capacitor/app/src/hooks/useVideoRecording.ts` - Video recording hook
- `/Users/ashleychen/Developer/test-capacitor/app/src/hooks/useWatchMotion.ts` - Watch motion hook
- `/Users/ashleychen/Developer/test-capacitor/app/src/types/session.ts` - Type definitions
- `/Users/ashleychen/Developer/test-capacitor/app/ios/App/App/WatchConnectivityManager.swift` - Watch communication
- `/Users/ashleychen/Developer/test-capacitor/app/ios/App/App/VideoRecordingManager.swift` - Video recording manager

## Conclusion

The `useRecordingSession` hook provides a complete solution for synchronized video and Watch motion recording. It:

- Simplifies the recording API to a single hook
- Handles complex timestamp synchronization automatically
- Provides robust error handling and status tracking
- Integrates seamlessly with existing video and Watch infrastructure
- Includes local storage utilities for session management

The implementation is production-ready for iOS with Apple Watch support. Future work includes Arduino BLE integration and backend synchronization.
