/**
 * RecordingActiveStep - Active recording display with stop control
 */

import { useState, useEffect } from 'react';
import { WizardStepProps } from '../../types/recordingWizard';

interface RecordingActiveStepProps extends WizardStepProps {
  onStopRecording: () => void;
  onSwitchCamera?: () => void;
  cameraPosition?: 'front' | 'back';
  videoPreviewElement?: React.ReactNode;
  onUpdateOverlay?: (options: { elapsedSeconds: number; totalSeconds: number }) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function RecordingIndicator() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`recording-indicator ${visible ? 'visible' : ''}`}>
      <div className="recording-dot" />
      <span>REC</span>
    </div>
  );
}

function StopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function CameraSwitchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function RecordingActiveStep({ state, onStopRecording, onSwitchCamera, cameraPosition = 'back', videoPreviewElement, onUpdateOverlay }: RecordingActiveStepProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const { recording, devices, plannedDuration } = state;

  // Update elapsed time
  useEffect(() => {
    if (!recording.isRecording || !recording.startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - recording.startTime!;
      setElapsedMs(elapsed);

      // Update native overlay
      if (onUpdateOverlay) {
        const elapsedSeconds = Math.floor(elapsed / 1000);
        const totalSeconds = plannedDuration * 60;
        onUpdateOverlay({ elapsedSeconds, totalSeconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [recording.isRecording, recording.startTime, plannedDuration, onUpdateOverlay]);

  // Calculate remaining time
  const plannedMs = plannedDuration * 60 * 1000;
  const remainingMs = Math.max(0, plannedMs - elapsedMs);
  const progressPercent = Math.min(100, (elapsedMs / plannedMs) * 100);

  return (
    <div className="wizard-step recording-active-step">
      {/* Video preview */}
      <div className="recording-preview-container">
        {videoPreviewElement || (
          <div className="recording-preview-placeholder">
            <span>Recording in Progress</span>
          </div>
        )}

        {/* Recording indicator */}
        <div className="recording-overlay-top">
          <RecordingIndicator />
        </div>

        {/* Timer overlay */}
        <div className="recording-overlay-bottom">
          <div className="recording-timer">
            <span className="timer-elapsed">{formatDuration(elapsedMs)}</span>
            <span className="timer-separator">/</span>
            <span className="timer-planned">{formatDuration(plannedMs)}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="recording-progress-container">
        <div className="recording-progress-bar">
          <div className="recording-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="recording-progress-labels">
          <span>Elapsed: {formatDuration(elapsedMs)}</span>
          <span>Remaining: {formatDuration(remainingMs)}</span>
        </div>
      </div>

      {/* Device status */}
      <div className="recording-device-status">
        <div className="device-status-item">
          <div className={`status-dot ${devices.watch.isConnected ? 'connected' : 'disconnected'}`} />
          <span>Watch: {devices.watch.isConnected ? 'Recording' : 'Disconnected'}</span>
        </div>
        <div className="device-status-item">
          <div className={`status-dot ${devices.racket.isConnected ? 'connected' : 'disconnected'}`} />
          <span>Racket: {devices.racket.isConnected ? 'Recording' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Started by indicator */}
      {recording.startedBy && (
        <p className="started-by-text">
          Started from {recording.startedBy === 'watch' ? 'Apple Watch' : 'Phone'}
        </p>
      )}

      {/* Stop button */}
      <div className="recording-actions">
        <button className="stop-recording-button" onClick={onStopRecording}>
          <StopIcon />
          <span>Stop Recording</span>
        </button>
      </div>
    </div>
  );
}

export default RecordingActiveStep;
