# Video Recording API Reference

## Quick Reference for Developers

### React Hook API

```typescript
import { useVideoRecording } from './hooks/useVideoRecording';

const {
  isRecording: boolean,
  duration: number,              // milliseconds
  error: string | null,
  hasPermission: boolean,
  startRecording: (sessionId: string) => Promise<void>,
  stopRecording: () => Promise<{videoPath: string, durationMs: number} | null>,
  requestPermissions: () => Promise<boolean>,
  checkPermissions: () => Promise<boolean>,
} = useVideoRecording();
```

### Plugin API

```typescript
import VideoRecording from './plugins/VideoRecording';

// Start recording
await VideoRecording.startRecording({ sessionId: 'session-123' });
// Returns: { success: boolean, sessionId: string }

// Stop recording
await VideoRecording.stopRecording();
// Returns: { videoPath: string, durationMs: number }

// Get status
await VideoRecording.getRecordingStatus();
// Returns: { isRecording: boolean, durationMs: number, sessionId?: string }

// Check permissions
await VideoRecording.checkPermissions();
// Returns: { camera: 'granted' | 'denied', microphone: 'granted' | 'denied' }

// Request permissions
await VideoRecording.requestPermissions();
// Returns: { camera: 'granted' | 'denied', microphone: 'granted' | 'denied' }
```

### Events

```typescript
// Recording started
VideoRecording.addListener('recordingStarted', () => {
  console.log('Recording started');
});

// Recording error
VideoRecording.addListener('recordingError', (data: { error: string }) => {
  console.error('Error:', data.error);
});

// Recording stopped
VideoRecording.addListener('recordingStopped', (data: { videoPath: string, durationMs: number }) => {
  console.log('Stopped:', data.videoPath);
});

// Recording progress
VideoRecording.addListener('recordingProgress', (data: { durationMs: number }) => {
  console.log('Duration:', data.durationMs);
});
```

### File Locations

Videos are saved to:
```
Documents/sessions/{sessionId}/video.mp4
```

Example full path:
```
/var/mobile/Containers/Data/Application/{UUID}/Documents/sessions/session-1738987654321/video.mp4
```

### Integration Pattern

```typescript
// Coordinate with watch motion and audio
const sessionId = `session-${Date.now()}`;

// Start all
await Promise.all([
  VideoRecording.startRecording({ sessionId }),
  WatchMotion.startRecording(),
  // ... other sensors
]);

// Stop all
const [video, motion] = await Promise.all([
  VideoRecording.stopRecording(),
  WatchMotion.stopRecording(),
]);

// Save session
await saveSession({
  sessionId,
  videoPath: video.videoPath,
  motionData: motion,
  // ...
});
```

### Camera Configuration

- **Camera:** Front-facing
- **Quality:** High (1080p)
- **Format:** MP4 (H.264 + AAC)
- **Mirroring:** Enabled
- **Stabilization:** Auto

### Limitations

- iOS only (not available on web)
- Requires real device (not Simulator)
- Max duration: 10 minutes (configurable in VideoRecordingManager.swift)
- Front camera only (can be changed to back camera in VideoRecordingManager.swift)

### Error Handling

Common errors:
- `"Camera or microphone permission denied"` - User needs to grant permissions
- `"A recording is already in progress"` - Stop current recording first
- `"No recording is currently in progress"` - Start recording before stopping
- `"Camera is not available"` - Check hardware availability

### Next Steps for Backend Team

Video upload endpoint needed:
```
POST /api/sessions/{sessionId}/video
Content-Type: multipart/form-data

Body:
- video: File (MP4)

Response:
{
  "success": true,
  "videoUrl": "https://api.example.com/sessions/123/video.mp4"
}
```
