/**
 * CameraPreviewStep - Live camera preview with start recording option
 */

import { WizardStepProps, RecordingStartedBy } from '../../types/recordingWizard';

interface CameraPreviewStepProps extends WizardStepProps {
  onStartRecording: (startedBy: RecordingStartedBy) => void;
  onSwitchCamera?: () => void;
  cameraPosition?: 'front' | 'back';
  videoPreviewElement?: React.ReactNode;
}

function RecordIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function WatchControlIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="10" rx="1" fill="white" />
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

export function CameraPreviewStep({ state, onStartRecording, onSwitchCamera, cameraPosition = 'back', videoPreviewElement }: CameraPreviewStepProps) {
  const { plannedDuration, recording } = state;
  const { watch } = state.devices;

  return (
    <div className="wizard-step camera-preview-step">
      {/* Camera preview area */}
      <div className="camera-preview-container">
        {videoPreviewElement || (
          <div className="camera-preview-placeholder">
            <span>Camera Preview</span>
            <p>Position your phone to capture the court</p>
          </div>
        )}

        {/* Overlay info */}
        <div className="preview-overlay-top">
          <div className="preview-duration-badge">
            <span>{plannedDuration} min session</span>
          </div>
          {onSwitchCamera && (
            <button className="camera-switch-button" onClick={onSwitchCamera}>
              <CameraSwitchIcon />
              <span>{cameraPosition === 'back' ? 'Front' : 'Back'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="camera-preview-controls">
        <div className="watch-start-hint">
          {watch.isConnected && recording.canStartFromWatch ? (
            <>
              <WatchControlIcon />
              <span>You can also start from your Apple Watch</span>
            </>
          ) : (
            <span>Tap the button below when you're ready</span>
          )}
        </div>

        <button className="start-recording-button" onClick={() => onStartRecording('phone')}>
          <RecordIcon />
          <span>Start Recording</span>
        </button>

        <div className="recording-tips">
          <p>Recording will capture video and sensor data from your Watch</p>
        </div>
      </div>
    </div>
  );
}

export default CameraPreviewStep;
