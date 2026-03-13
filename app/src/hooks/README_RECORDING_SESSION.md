# useRecordingSession Hook

A React hook for orchestrating synchronized video and Apple Watch motion recording sessions.

## Overview

The `useRecordingSession` hook combines video recording from the iPhone camera and IMU sensor data from the Apple Watch into a single synchronized recording session. It handles:

- Session ID generation and management
- Synchronized start/stop of video and Watch recording
- Real-time sensor data collection with timestamp synchronization
- Status tracking for both video and Watch components
- Error handling and recovery

## Features

- **Unified API**: Single hook to control both video and Watch recording
- **Timestamp Synchronization**: All sensor data is timestamped relative to session start
- **Status Tracking**: Separate status for video camera and Watch connection
- **Error Resilience**: Can continue recording video even if Watch fails
- **Real-time Data Collection**: Collects sensor samples during recording
- **Native Platform Detection**: Automatically handles web vs native platforms

## Installation

The hook is already integrated into the app. Simply import it:

```typescript
import { useRecordingSession } from '../hooks/useRecordingSession';
```

## Basic Usage

```typescript
import { useRecordingSession } from '../hooks/useRecordingSession';

function RecordingComponent() {
  const {
    isRecording,
    startRecording,
    stopRecording,
    duration,
    error
  } = useRecordingSession();

  const handleStart = async () => {
    try {
      await startRecording();
    } catch (err) {
      console.error('Failed to start:', err);
    }
  };

  const handleStop = async () => {
    try {
      const result = await stopRecording();
      console.log('Video path:', result?.videoPath);
      console.log('Samples:', result?.sensorSamples.length);
    } catch (err) {
      console.error('Failed to stop:', err);
    }
  };

  return (
    <div>
      <button onClick={handleStart} disabled={isRecording}>
        Start Recording
      </button>
      <button onClick={handleStop} disabled={!isRecording}>
        Stop Recording
      </button>
      <div>Duration: {duration}ms</div>
      {error && <div>Error: {error}</div>}
    </div>
  );
}
```

## API Reference

### State Properties

```typescript
interface RecordingSessionState {
  sessionId: string | null;        // UUID of current session
  isRecording: boolean;             // Overall recording status
  startTime: number | null;         // Unix timestamp (ms) when recording started
  duration: number;                 // Duration in ms since start
  videoStatus: VideoStatus;         // 'idle' | 'recording' | 'error'
  watchStatus: WatchStatus;         // 'idle' | 'recording' | 'error' | 'disconnected'
  error: string | null;             // Last error message
}
```

### Methods

#### `startRecording()`

Starts a synchronized recording session.

**Returns**: `Promise<void>`

**Throws**: Error if already recording or on unsupported platform

**Process**:
1. Generates a UUID session ID
2. Sets up motion data listener
3. Sends START command to Watch
4. Starts iPhone video recording
5. Begins collecting sensor data

**Example**:
```typescript
try {
  await startRecording();
  console.log('Recording started successfully');
} catch (err) {
  if (err.message === 'Recording already in progress') {
    // Handle already recording
  } else if (err.message.includes('iOS')) {
    // Handle platform error
  } else {
    // Handle other errors
  }
}
```

#### `stopRecording()`

Stops the recording session and returns results.

**Returns**: `Promise<RecordingSessionResult | null>`

```typescript
interface RecordingSessionResult {
  sessionId: string;              // UUID of the session
  startTime: number;              // Unix timestamp (ms) when started
  endTime: number;                // Unix timestamp (ms) when stopped
  duration: number;               // Total duration in ms
  videoPath: string | null;       // Path to saved video file
  sensorSamples: SensorSample[];  // Array of collected sensor data
}
```

**Process**:
1. Stops video recording
2. Sends STOP command to Watch
3. Removes motion listener
4. Collects all sensor samples
5. Resets state after 1 second

**Example**:
```typescript
const result = await stopRecording();
if (result) {
  console.log('Session ID:', result.sessionId);
  console.log('Duration:', result.duration, 'ms');
  console.log('Video saved at:', result.videoPath);
  console.log('Collected', result.sensorSamples.length, 'samples');

  // Save to database or upload to server
  await saveSession(result);
}
```

#### `getSensorData()`

Returns a snapshot of currently collected sensor samples.

**Returns**: `SensorSample[]`

**Usage**: Call this during recording to get real-time sample count or preview data.

```typescript
const samples = getSensorData();
console.log(`Collected ${samples.length} samples so far`);
```

## Sensor Data Format

Each sensor sample contains:

```typescript
interface SensorSample {
  t: number;                      // Relative time in ms from session start
  accel: {                        // Accelerometer (g-force)
    x: number;
    y: number;
    z: number;
  };
  gyro: {                         // Gyroscope (rad/s)
    x: number;
    y: number;
    z: number;
  };
  orientation: {                  // Device orientation (radians)
    roll: number;
    pitch: number;
    yaw: number;
  };
}
```

## Timestamp Synchronization

The hook uses the following timestamp strategy:

1. **Session Start**: Records `startTime = Date.now()` when `startRecording()` is called
2. **Watch Recording**: Sends START command to Watch with session start time
3. **Sensor Samples**: Each incoming Watch data point is timestamped with:
   - `t = Date.now() - startTime` (relative ms from start)
4. **Absolute Time**: To convert back: `absoluteTime = startTime + sample.t`

This ensures that:
- All timestamps are synchronized to the iPhone clock
- Sensor data can be aligned with video frames
- Multiple sensor sources can be time-aligned

## Status Monitoring

### Video Status

```typescript
type VideoStatus = 'idle' | 'recording' | 'error';
```

- **idle**: Camera not recording
- **recording**: Camera actively recording
- **error**: Video recording failed (see `error` property)

### Watch Status

```typescript
type WatchStatus = 'idle' | 'recording' | 'error' | 'disconnected';
```

- **idle**: Watch not recording
- **recording**: Watch actively sending sensor data
- **error**: Failed to start Watch recording
- **disconnected**: Watch connection lost during recording

The hook checks Watch connectivity every 2 seconds during recording.

## Error Handling

The hook is designed to be resilient:

### Watch Failure
If the Watch fails to start or disconnects:
- Video recording continues
- `watchStatus` is set to 'error' or 'disconnected'
- `error` property contains error message
- `sensorSamples` will be empty or incomplete

```typescript
const result = await stopRecording();
if (result.sensorSamples.length === 0) {
  console.warn('No Watch data collected');
  // Still have video in result.videoPath
}
```

### Video Failure
If video recording fails:
- Watch recording is stopped
- Session is aborted
- Error is thrown from `startRecording()`

```typescript
try {
  await startRecording();
} catch (err) {
  // Session was not started
  console.error('Video recording failed:', err);
}
```

## Platform Support

- **iOS Native**: Full support (requires paired Apple Watch)
- **Android**: Not supported (will throw error)
- **Web**: Not supported (will throw error)

Check platform before using:

```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
  // Safe to use useRecordingSession
}
```

## Permissions

The hook automatically requests necessary permissions:

- **Camera**: Required for video recording
- **Microphone**: Required for audio in video
- **Watch Connectivity**: Automatically managed by iOS

If permissions are denied, an error is set and `startRecording()` throws.

## Example: Complete Recording Flow

```typescript
import { useState } from 'react';
import { useRecordingSession } from '../hooks/useRecordingSession';

function RecordingScreen() {
  const [savedResults, setSavedResults] = useState<any[]>([]);

  const {
    sessionId,
    isRecording,
    duration,
    videoStatus,
    watchStatus,
    error,
    startRecording,
    stopRecording,
    getSensorData,
  } = useRecordingSession();

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (err) {
      alert(`Failed to start: ${err.message}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      const result = await stopRecording();

      if (result) {
        // Save to your backend or local database
        setSavedResults([...savedResults, result]);

        // Upload video file
        if (result.videoPath) {
          await uploadVideo(result.videoPath, result.sessionId);
        }

        // Upload sensor data
        if (result.sensorSamples.length > 0) {
          await uploadSensorData(result.sensorSamples, result.sessionId);
        }

        alert(`Recording saved! ${result.sensorSamples.length} samples collected`);
      }
    } catch (err) {
      alert(`Failed to stop: ${err.message}`);
    }
  };

  return (
    <div>
      <h1>Record Session</h1>

      {/* Status Display */}
      <div>
        <div>Session: {sessionId || 'No active session'}</div>
        <div>Duration: {Math.floor(duration / 1000)}s</div>
        <div>Video: {videoStatus}</div>
        <div>Watch: {watchStatus}</div>
        {isRecording && <div>Samples: {getSensorData().length}</div>}
        {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      </div>

      {/* Control Buttons */}
      <button onClick={handleStartRecording} disabled={isRecording}>
        {isRecording ? 'Recording...' : 'Start Recording'}
      </button>

      <button onClick={handleStopRecording} disabled={!isRecording}>
        Stop Recording
      </button>

      {/* Previous Recordings */}
      <h2>Saved Recordings</h2>
      {savedResults.map((result, i) => (
        <div key={i}>
          <div>Session {i + 1}</div>
          <div>Duration: {result.duration}ms</div>
          <div>Samples: {result.sensorSamples.length}</div>
        </div>
      ))}
    </div>
  );
}
```

## Integration with Backend

Example of uploading session data:

```typescript
async function uploadSession(result: RecordingSessionResult) {
  // Upload video file
  if (result.videoPath) {
    const formData = new FormData();
    formData.append('video', {
      uri: result.videoPath,
      type: 'video/mp4',
      name: `${result.sessionId}.mp4`
    });

    await fetch('https://api.example.com/sessions/video', {
      method: 'POST',
      body: formData,
      headers: {
        'X-Session-ID': result.sessionId
      }
    });
  }

  // Upload sensor data
  await fetch('https://api.example.com/sessions/sensor-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: result.sessionId,
      startTime: result.startTime,
      endTime: result.endTime,
      samples: result.sensorSamples
    })
  });
}
```

## Troubleshooting

### No sensor data collected

**Possible causes**:
1. Watch is not connected (check `watchStatus`)
2. Watch app is not running
3. Watch Connectivity not authorized

**Solution**: Check Watch connection before recording:
```typescript
import { WatchMotion } from '../hooks/useWatchMotion';

const { connected } = await WatchMotion.isWatchConnected();
if (!connected) {
  alert('Please ensure Apple Watch is connected and the app is running');
}
```

### Video recording fails immediately

**Possible causes**:
1. Camera/microphone permissions denied
2. Another app is using the camera
3. Device storage full

**Solution**: Check and request permissions:
```typescript
import VideoRecording from '../plugins/VideoRecording';

const permissions = await VideoRecording.checkPermissions();
if (permissions.camera !== 'granted' || permissions.microphone !== 'granted') {
  await VideoRecording.requestPermissions();
}
```

### Watch disconnects during recording

The hook automatically detects disconnection and sets `watchStatus` to 'disconnected'. The video recording continues, but sensor data collection stops.

**Recovery**: The user can stop the recording and will still have the video file and any sensor data collected before disconnection.

## Related Hooks

- **useVideoRecording**: Low-level hook for video-only recording
- **useWatchMotion**: Low-level hook for Watch motion data (display only)
- **useWatchAudio**: Hook for Watch audio streaming

## License

Part of the Sensor Recording App project.
