/**
 * CalibrationIntroStep - "Next, you will calibrate your grip"
 */

import { WizardStepProps } from '../../types/recordingWizard';

function GripIcon() {
  return (
    <svg className="calibration-intro-icon" width="80" height="80" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#0A6C3B" strokeWidth="2" />
      <path
        d="M12 7v5M9 15c0 1.5 1.5 3 3 3s3-1.5 3-3"
        stroke="#0A6C3B"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7" r="1.5" fill="#0A6C3B" />
    </svg>
  );
}

export function CalibrationIntroStep({ onNext }: WizardStepProps) {
  return (
    <div className="wizard-step calibration-intro-step">
      <div className="wizard-step-content">
        <GripIcon />

        <h1 className="wizard-title">Calibrate Your Grip</h1>
        <p className="wizard-subtitle">
          Next, we'll measure your grip strength to personalize your experience
        </p>

        <div className="calibration-info">
          <div className="calibration-info-item">
            <span className="info-number">1</span>
            <span className="info-text">Hold your racket naturally</span>
          </div>
          <div className="calibration-info-item">
            <span className="info-number">2</span>
            <span className="info-text">Squeeze as hard as you can</span>
          </div>
          <div className="calibration-info-item">
            <span className="info-number">3</span>
            <span className="info-text">Hold for 5 seconds</span>
          </div>
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary" onClick={onNext}>
          Let's Go
        </button>
      </div>
    </div>
  );
}

export default CalibrationIntroStep;
