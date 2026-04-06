/**
 * CalibrationInstructionsStep - "Hold racket, squeeze for 5 seconds"
 */

import { WizardStepProps } from '../../types/recordingWizard';

function HandGripIcon() {
  return (
    <svg className="grip-instruction-icon" width="120" height="120" viewBox="0 0 24 24" fill="none">
      {/* Hand holding racket illustration */}
      <ellipse cx="12" cy="8" rx="5" ry="6" stroke="#333" strokeWidth="1.5" fill="none" />
      <line x1="12" y1="14" x2="12" y2="22" stroke="#333" strokeWidth="2" strokeLinecap="round" />
      {/* Grip pressure indicators */}
      <path
        d="M6 10c-2 0-3 1-3 2.5s1 2.5 3 2.5"
        stroke="#0A6C3B"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 10c2 0 3 1 3 2.5s-1 2.5-3 2.5"
        stroke="#0A6C3B"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrows indicating squeeze */}
      <path d="M4 12l2 0" stroke="#0A6C3B" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 12l2 0" stroke="#0A6C3B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface CalibrationInstructionsStepProps extends WizardStepProps {
  onStartCalibration: () => void;
}

export function CalibrationInstructionsStep({ onStartCalibration }: CalibrationInstructionsStepProps) {
  return (
    <div className="wizard-step calibration-instructions-step">
      <div className="wizard-step-content">
        <HandGripIcon />

        <h1 className="wizard-title">Get Ready</h1>
        <p className="wizard-subtitle">Hold your racket and prepare to squeeze</p>

        <div className="instruction-card">
          <p className="instruction-text">
            When you tap "Start", squeeze your grip as{' '}
            <strong>hard as you can</strong> for <strong>5 seconds</strong>
          </p>
        </div>

        <div className="watch-sync-note">
          <span className="watch-icon-small">&#x231A;</span>
          <span>Your Apple Watch will show the countdown</span>
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary large" onClick={onStartCalibration}>
          Start Calibration
        </button>
      </div>
    </div>
  );
}

export default CalibrationInstructionsStep;
