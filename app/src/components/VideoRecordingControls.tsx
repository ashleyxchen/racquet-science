/**
 * VideoRecordingControls Component
 *
 * Example component showing how to use the video recording hook
 */

import React from 'react';
import { useVideoRecording } from '../hooks/useVideoRecording';

interface VideoRecordingControlsProps {
  sessionId: string;
  onRecordingComplete?: (videoPath: string, duration: number) => void;
}

export function VideoRecordingControls({
  sessionId,
  onRecordingComplete,
}: VideoRecordingControlsProps) {
  const {
    isRecording,
    duration,
    error,
    hasPermission,
    startRecording,
    stopRecording,
    requestPermissions,
  } = useVideoRecording();

  const handleStartRecording = async () => {
    try {
      await startRecording(sessionId);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const handleStopRecording = async () => {
    try {
      const result = await stopRecording();
      if (result && onRecordingComplete) {
        onRecordingComplete(result.videoPath, result.durationMs);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  const handleRequestPermissions = async () => {
    await requestPermissions();
  };

  // Format duration as MM:SS
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-recording-controls">
      <div className="recording-status">
        {isRecording && (
          <>
            <span className="recording-indicator">🔴</span>
            <span className="recording-duration">{formatDuration(duration)}</span>
          </>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span>Error: {error}</span>
        </div>
      )}

      {!hasPermission && !isRecording && (
        <button onClick={handleRequestPermissions} className="btn-permission">
          Grant Camera Permission
        </button>
      )}

      {hasPermission && !isRecording && (
        <button onClick={handleStartRecording} className="btn-start-recording">
          Start Video Recording
        </button>
      )}

      {isRecording && (
        <button onClick={handleStopRecording} className="btn-stop-recording">
          Stop Recording
        </button>
      )}
    </div>
  );
}

// Example usage in a parent component:
/*
import { VideoRecordingControls } from './components/VideoRecordingControls';

function SessionPage() {
  const [sessionId] = useState(() => `session-${Date.now()}`);

  const handleRecordingComplete = (videoPath: string, duration: number) => {
    console.log('Video saved at:', videoPath);
    console.log('Duration:', duration, 'ms');

    // You can now:
    // 1. Store the videoPath in your session data
    // 2. Upload the video to your backend
    // 3. Display a confirmation to the user
  };

  return (
    <div>
      <h1>Recording Session</h1>
      <VideoRecordingControls
        sessionId={sessionId}
        onRecordingComplete={handleRecordingComplete}
      />
    </div>
  );
}
*/
