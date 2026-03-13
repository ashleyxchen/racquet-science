/**
 * CameraSetupIntroStep - Camera setup introduction
 */

import { WizardStepProps } from '../../types/recordingWizard';

function CameraIcon() {
  return (
    <svg className="camera-intro-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#0A6C3B" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="2" fill="#0A6C3B" />
      <path d="M17 5v-1a1 1 0 00-1-1h-2a1 1 0 00-1 1v1" />
    </svg>
  );
}

export function CameraSetupIntroStep({ onNext }: WizardStepProps) {
  return (
    <div className="wizard-step camera-setup-intro-step">
      <div className="wizard-step-content">
        <CameraIcon />

        <h1 className="wizard-title">Set Up Your Camera</h1>
        <p className="wizard-subtitle">Position your phone to capture your session</p>

        <div className="camera-tips">
          <div className="camera-tip">
            <span className="tip-icon">&#128247;</span>
            <span className="tip-text">Place your phone where it can see the court</span>
          </div>
          <div className="camera-tip">
            <span className="tip-icon">&#128161;</span>
            <span className="tip-text">Make sure there's good lighting</span>
          </div>
          <div className="camera-tip">
            <span className="tip-icon">&#128274;</span>
            <span className="tip-text">Use a tripod or stable surface</span>
          </div>
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary" onClick={onNext}>
          Open Camera
        </button>
      </div>
    </div>
  );
}

export default CameraSetupIntroStep;
