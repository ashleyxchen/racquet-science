/**
 * CameraInstructionsStep - Instructions for camera positioning
 */

import { WizardStepProps } from '../../types/recordingWizard';

function FrameGuideIcon() {
  return (
    <svg className="frame-guide-icon" width="120" height="90" viewBox="0 0 120 90" fill="none">
      {/* Court outline */}
      <rect x="10" y="10" width="100" height="70" stroke="#e0e0e0" strokeWidth="2" fill="none" rx="4" />
      {/* Court lines */}
      <line x1="60" y1="10" x2="60" y2="80" stroke="#e0e0e0" strokeWidth="1" />
      <line x1="10" y1="45" x2="110" y2="45" stroke="#e0e0e0" strokeWidth="1" />
      {/* Player zone */}
      <ellipse cx="35" cy="60" rx="15" ry="10" stroke="#0A6C3B" strokeWidth="2" fill="none" strokeDasharray="4 2" />
      {/* Camera angle indicator */}
      <path d="M60 5 L55 0 M60 5 L65 0" stroke="#E0FF2D" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CameraInstructionsStep({ onNext }: WizardStepProps) {
  return (
    <div className="wizard-step camera-instructions-step">
      <div className="wizard-step-content">
        <h1 className="wizard-title">Frame Your Shot</h1>

        <FrameGuideIcon />

        <div className="framing-instructions">
          <div className="instruction-item">
            <span className="instruction-number">1</span>
            <div className="instruction-content">
              <strong>Position behind the baseline</strong>
              <p>Set up your phone behind and slightly to the side</p>
            </div>
          </div>

          <div className="instruction-item">
            <span className="instruction-number">2</span>
            <div className="instruction-content">
              <strong>Capture the full court</strong>
              <p>Make sure the net and both service boxes are visible</p>
            </div>
          </div>

          <div className="instruction-item">
            <span className="instruction-number">3</span>
            <div className="instruction-content">
              <strong>Lock the focus</strong>
              <p>Tap and hold on the court to lock exposure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary" onClick={onNext}>
          Continue to Preview
        </button>
      </div>
    </div>
  );
}

export default CameraInstructionsStep;
