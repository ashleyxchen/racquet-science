/**
 * PostCalibrationIntroStep - "Let's check your grip after the session"
 */

import { WizardStepProps } from '../../types/recordingWizard';

function PostGripIcon() {
  return (
    <svg className="calibration-intro-icon" width="80" height="80" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#0A6C3B" strokeWidth="2" />
      <path
        d="M8 12h8M12 8v8"
        stroke="#0A6C3B"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9 15c0 1.5 1.5 3 3 3s3-1.5 3-3"
        stroke="#0A6C3B"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface PostCalibrationIntroStepProps extends WizardStepProps {
  onSkip: () => void;
}

export function PostCalibrationIntroStep({ onNext, onSkip }: PostCalibrationIntroStepProps) {
  return (
    <div className="wizard-step post-calibration-intro-step">
      <div className="wizard-step-content">
        <PostGripIcon />

        <h1 className="wizard-title">Post-Session Calibration</h1>
        <p className="wizard-subtitle">
          Let's measure your grip strength again to see how it changed during your session
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
          Start Calibration
        </button>
        <button className="wizard-button secondary" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

export default PostCalibrationIntroStep;
