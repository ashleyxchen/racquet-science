# Apple Watch Audio Recording & Live Playback Implementation Plan

## Overview
Add real-time audio recording from Apple Watch SE2, streaming to iOS via WatchConnectivity, with live playback in the ConnectionTestPage.

## Research Summary

### watchOS Audio Recording (Sources)
- [AVAudioEngine is available on watchOS 4+](https://developer.apple.com/forums/thread/5570) with AVAudioInputNode for microphone access
- Recording can only start when the watch app is in **foreground**
- Need `NSMicrophoneUsageDescription` in Watch app's Info.plist
- Use `installTap(onBus:)` on AVAudioInputNode to receive PCM buffers in real-time

### Data Transport
- `WCSession.sendMessageData()` is best for real-time streaming when both apps are reachable
- Audio data is larger than motion - need efficient chunking (recommend 16kHz mono = ~32KB/sec for Float32)
- Use message type differentiation: `"type": "audio"` vs `"type": "motion"`

### iOS Playback (Sources)
- [AVAudioEngine with AVAudioPlayerNode](https://www.syedharisali.com/articles/streaming-audio-with-avaudioengine/) for real-time buffer playback
- [Scheduling PCM buffers](https://github.com/syedhali/AudioStreamer) onto player node for streaming
- Need to handle buffer underruns gracefully with silence

---

## Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLE WATCH                               │
├─────────────────────────────────────────────────────────────────┤
│  AudioManager.swift (NEW)                                        │
│  ├── AVAudioEngine + AVAudioInputNode                           │
│  ├── installTap() → PCM Float32 buffers                         │
│  ├── Calculate RMS → dB level                                   │
│  └── Send via WCSession.sendMessageData()                       │
│                                                                  │
│  MotionManager.swift (existing - no changes)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WatchConnectivity
                              │ sendMessageData() for audio
                              │ sendMessage() for motion (existing)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          iOS APP                                 │
├─────────────────────────────────────────────────────────────────┤
│  WatchConnectivityManager.swift (MODIFY)                        │
│  ├── Handle didReceiveMessageData for audio                     │
│  ├── Forward audio to AudioPlaybackManager                      │
│  └── Forward dB level to WatchMotionPlugin                      │
│                                                                  │
│  AudioPlaybackManager.swift (NEW)                               │
│  ├── AVAudioEngine + AVAudioPlayerNode                          │
│  ├── Circular buffer for incoming audio                         │
│  ├── Schedule PCM buffers for playback                          │
│  └── Mute/unmute control                                        │
│                                                                  │
│  WatchMotionPlugin.swift (MODIFY)                               │
│  ├── Add audioData event listener                               │
│  ├── Add setMuted() method                                      │
│  └── Add getAudioStatus() method                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Capacitor Bridge
                              │ notifyListeners("audioData")
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        REACT APP                                 │
├─────────────────────────────────────────────────────────────────┤
│  useWatchAudio.ts (NEW HOOK)                                    │
│  ├── Listen for audioData events                                │
│  ├── Track dB level, connection status                          │
│  └── Expose setMuted() function                                 │
│                                                                  │
│  AudioLevelDisplay.tsx (NEW COMPONENT)                          │
│  ├── Visual dB meter                                            │
│  └── Mute/unmute toggle button                                  │
│                                                                  │
│  ConnectionTestPage.tsx (MODIFY)                                │
│  └── Add "Apple Watch Audio" DataSection                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Watch App: AudioManager.swift

**Location:** `/app/ios/App/Watchkit App Watch App/AudioManager.swift`

```swift
// Key components:
- Singleton pattern (like MotionManager)
- AVAudioEngine with inputNode tap
- Format: 16kHz, mono, Float32 (balance quality vs bandwidth)
- Buffer size: 1024 frames (~64ms at 16kHz)
- Calculate dB: 20 * log10(rms) where rms = sqrt(sum(samples²)/count)
- Send audio chunks via WCSession.default.sendMessageData()
- Message format:
  - First 4 bytes: Float32 dB level
  - Remaining bytes: PCM audio data
```

**Permissions needed in Watch Info.plist:**
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Records audio during practice sessions</string>
```

### 2. iOS: WatchConnectivityManager.swift Modifications

**Add to existing file:**
```swift
// New callback for audio data
var audioDataCallback: ((_ audioData: Data, _ dbLevel: Float) -> Void)?

// Implement didReceiveMessageData delegate method
func session(_ session: WCSession, didReceiveMessageData messageData: Data) {
    // Extract dB level from first 4 bytes
    // Extract audio PCM data from remaining bytes
    // Forward to AudioPlaybackManager and callback
}
```

### 3. iOS: AudioPlaybackManager.swift (NEW)

**Location:** `/app/ios/App/App/AudioPlaybackManager.swift`

```swift
// Key components:
- Singleton pattern
- AVAudioEngine with AVAudioPlayerNode
- Audio format matching watch: 16kHz, mono, Float32
- Circular buffer to handle timing jitter
- scheduleBuffer() with .interrupts option for smooth playback
- isMuted property to control output
- Handle buffer underruns with silence
```

### 4. Capacitor Plugin: WatchMotionPlugin.swift Modifications

**Add new methods:**
```swift
// New plugin methods:
- setAudioMuted(muted: Bool) → Promise
- getAudioStatus() → { isReceiving: Bool, dbLevel: Float, isMuted: Bool }

// New event:
- notifyListeners("audioData", data: ["dbLevel": Float, "timestamp": Double])
```

### 5. React: useWatchAudio.ts Hook

**Location:** `/app/src/hooks/useWatchAudio.ts`

```typescript
interface WatchAudioState {
  isReceiving: boolean;
  dbLevel: number;      // Current dB level (-60 to 0 typical range)
  isMuted: boolean;
}

// Hook returns:
{
  audioState: WatchAudioState;
  setMuted: (muted: boolean) => Promise<void>;
}
```

### 6. React: AudioLevelDisplay.tsx Component

**Location:** `/app/src/components/AudioLevelDisplay.tsx`

```typescript
// Visual dB meter (horizontal bar)
// Color gradient: green → yellow → red
// Mute/unmute toggle button
// Display numeric dB value
```

### 7. ConnectionTestPage.tsx Modifications

**Add new DataSection:**
```tsx
<DataSection title="Apple Watch Audio">
  <div className="status-indicator">
    {audioState.isReceiving ? "Receiving Audio" : "No Audio"}
  </div>
  <AudioLevelDisplay
    dbLevel={audioState.dbLevel}
    isMuted={audioState.isMuted}
    onMuteToggle={() => setMuted(!audioState.isMuted)}
  />
</DataSection>
```

---

## Audio Format Specifications

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Sample Rate | 16,000 Hz | Good speech quality, lower bandwidth |
| Channels | 1 (Mono) | Watch has single mic, reduces data |
| Bit Depth | Float32 | Native AVAudioEngine format |
| Buffer Size | 1024 frames | ~64ms, good latency/efficiency balance |
| Data Rate | ~64 KB/sec | Manageable over WatchConnectivity |

---

## File Changes Summary

### New Files (5)
1. `app/ios/App/Watchkit App Watch App/AudioManager.swift` - Watch audio capture
2. `app/ios/App/App/AudioPlaybackManager.swift` - iOS audio playback
3. `app/src/hooks/useWatchAudio.ts` - React hook for audio state
4. `app/src/components/AudioLevelDisplay.tsx` - dB meter UI component
5. `app/ios/App/Watchkit App/Info.plist` - Add microphone permission (or modify existing)

### Modified Files (4)
1. `app/ios/App/App/WatchConnectivityManager.swift` - Handle audio data
2. `app/ios/App/App/WatchMotionPlugin.swift` - Add audio methods/events
3. `app/src/plugins/WatchMotionPlugin.ts` - Add TypeScript definitions
4. `app/src/pages/ConnectionTestPage.tsx` - Add audio section UI

---

## Implementation Order

1. **Phase 1: Watch Audio Capture**
   - Add microphone permission to Watch Info.plist
   - Create AudioManager.swift with AVAudioEngine tap
   - Test audio capture locally (log dB levels)

2. **Phase 2: Data Transport**
   - Modify WatchConnectivityManager to handle audio data
   - Implement sendMessageData on watch
   - Test data arrives on iOS (log received bytes)

3. **Phase 3: iOS Playback**
   - Create AudioPlaybackManager with AVAudioEngine
   - Wire up received audio to playback
   - Test live audio playback

4. **Phase 4: Capacitor Bridge**
   - Add audio methods to WatchMotionPlugin
   - Update TypeScript plugin definitions
   - Create useWatchAudio hook

5. **Phase 5: UI**
   - Create AudioLevelDisplay component
   - Add section to ConnectionTestPage
   - Style and polish

---

## Potential Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Audio latency | Use small buffers (1024 frames), prioritize sendMessageData |
| Buffer underruns | Fill with silence, use circular buffer with padding |
| Watch battery drain | 16kHz sample rate reduces processing load |
| Large data transfer | Chunk audio, compress if needed (consider Opus codec later) |
| Background recording | Document limitation - watch app must be foreground |
| Memory pressure | Reuse audio buffers, limit queue depth |

---

## Design Decisions (Confirmed)

1. **Audio quality**: 16kHz mono - good speech quality, efficient bandwidth
2. **Recording scope**: Synced with motion - audio starts/stops with motion recording
3. **Persistence**: Save audio files alongside motion data for later playback

---

## Additional Implementation for Audio Persistence

### Audio File Storage
- Save audio as `.wav` files (16kHz, mono, Float32)
- Store in same session folder as motion data
- File naming: `session_<id>_audio.wav`

### StorageService.ts Modifications
```typescript
// Add methods:
- appendAudioData(sessionId: string, audioChunk: ArrayBuffer): Promise<void>
- getAudioFile(sessionId: string): Promise<string | null>  // Returns file URL
- finalizeAudioFile(sessionId: string): Promise<void>  // Write WAV header
```

### iOS AudioPlaybackManager Additions
- Buffer incoming audio to temp file while playing
- On session end, move to permanent storage
- Support playback of saved audio files

---

## Phase 3: Session Playback UI

### SessionListPage.tsx (Implement)
- Fetch sessions from StorageService
- Display as cards with:
  - Date/time
  - Duration
  - Sport type
  - Data indicators (Watch IMU, Racket, Video, Audio)
- Tap to navigate to playback

### SessionPlaybackPage.tsx (Implement)
- Video player with controls (play/pause, seek, timeline)
- Audio playback synced with video
- Time-series graphs for IMU data:
  - Accelerometer (X, Y, Z) over time
  - Gyroscope (X, Y, Z) over time
  - Orientation (roll, pitch, yaw) over time
- Event markers displayed on timeline
- Playback position syncs across all visualizations

### New Components
1. **TimeSeriesChart.tsx** - Reusable chart component using a lightweight library
2. **VideoPlayer.tsx** - Video element with custom controls
3. **PlaybackTimeline.tsx** - Unified timeline showing markers
4. **SessionCard.tsx** - Card component for session list

### Charting Library
- Recommend **Recharts** (React-friendly, lightweight) or **Chart.js** with react-chartjs-2
- Display ~10 seconds of data in view, scroll with playback position
- Downsample data for performance (10Hz → display every Nth point)

### Data Synchronization
- Use video currentTime as master clock
- Sample IMU data at corresponding timestamp
- Highlight current position on graphs

---

## Complete File Changes Summary

### New Files (11)
| File | Purpose |
|------|---------|
| `ios/.../AudioStreamManager.swift` | Watch audio capture & streaming |
| `ios/.../AudioPlaybackManager.swift` | iOS playback & WAV writing |
| `src/hooks/useWatchAudio.ts` | Audio state hook |
| `src/hooks/useSessionPlayback.ts` | Playback state management |
| `src/components/AudioLevelDisplay.tsx` | Live dB meter |
| `src/components/TimeSeriesChart.tsx` | IMU graphs |
| `src/components/VideoPlayer.tsx` | Video with controls |
| `src/components/PlaybackTimeline.tsx` | Unified timeline |
| `src/components/SessionCard.tsx` | Session list item |
| `package.json` | Add recharts dependency |

### Modified Files (8)
| File | Changes |
|------|---------|
| `ios/.../MotionManager.swift` | Remove AVAudioRecorder, use AudioStreamManager |
| `ios/.../WatchConnectivityManager.swift` | Handle audio data |
| `ios/.../WatchMotionPlugin.swift` | Audio events & methods |
| `ios/Watchkit App/Info.plist` | Microphone permission |
| `src/plugins/WatchMotionPlugin.ts` | TypeScript definitions |
| `src/pages/ConnectionTestPage.tsx` | Add audio section |
| `src/pages/SessionListPage.tsx` | Implement session list |
| `src/pages/SessionPlaybackPage.tsx` | Implement playback UI |
| `src/services/StorageService.ts` | Audio file methods |
| `src/css/style.css` | New component styles |

---

## Implementation Order

### Phase 1: Watch Audio Streaming (ConnectionTestPage)
1. Add microphone permission to Watch Info.plist
2. Create AudioStreamManager.swift on Watch
3. Modify MotionManager to use AudioStreamManager
4. Modify WatchConnectivityManager for audio data
5. Create AudioPlaybackManager.swift on iOS
6. Modify WatchMotionPlugin for audio events
7. Create useWatchAudio.ts hook
8. Create AudioLevelDisplay.tsx component
9. Update ConnectionTestPage.tsx

### Phase 2: Audio Persistence
10. Add audio methods to StorageService
11. Update sessions table schema (has_audio flag)
12. Wire AudioPlaybackManager to save WAV files

### Phase 3: Session Playback UI
13. Install recharts dependency
14. Create TimeSeriesChart.tsx component
15. Create VideoPlayer.tsx component
16. Create PlaybackTimeline.tsx component
17. Create SessionCard.tsx component
18. Create useSessionPlayback.ts hook
19. Implement SessionListPage.tsx
20. Implement SessionPlaybackPage.tsx
21. Add styles to style.css
