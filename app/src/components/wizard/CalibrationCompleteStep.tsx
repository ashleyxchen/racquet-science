/**
 * CalibrationCompleteStep - "Phew, you're strong!"
 */

import { WizardStepProps } from '../../types/recordingWizard';

function MuscleIcon() {
  return (
    <svg className="muscle-icon" width="80" height="80" viewBox="0 0 24 24" fill="#0A6C3B">
      <path d="M12 4c-1.5 0-2.5 1-3 2-.5-1-1.5-2-3-2-2 0-3.5 1.5-3.5 3.5 0 3 3 5.5 6 8.5l.5.5.5-.5c3-3 6-5.5 6-8.5C15.5 5.5 14 4 12 4z" />
      <path d="M17 8c-.5 0-1 .2-1.5.5.3.8.5 1.6.5 2.5 0 2-1.5 4-3.5 6 1.5 1.5 3 2.5 4.5 2.5 2.5 0 4.5-2 4.5-4.5S19.5 8 17 8z" opacity="0.7" />
    </svg>
  );
}

export function CalibrationCompleteStep({ state, onNext }: WizardStepProps) {
  const maxForce = state.calibrationResult?.maxForce || state.calibration.maxForce;

  // Determine strength message based on force value
  const getStrengthMessage = () => {
    if (maxForce >= 60) return "Wow, you're incredibly strong!";
    if (maxForce >= 45) return "Phew, you're strong!";
    if (maxForce >= 30) return "Great grip strength!";
    return "Good job!";
  };

  return (
    <div className="wizard-step calibration-complete-step">
      <div className="wizard-step-content centered">
        <MuscleIcon />

        <h1 className="wizard-title">{getStrengthMessage()}</h1>
        <p className="wizard-subtitle">Grip calibration complete</p>

        <div className="calibration-summary">
          <div className="summary-item">
            <span className="summary-label">Peak Force</span>
            <span className="summary-value">{maxForce.toFixed(1)} N</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Duration</span>
            <span className="summary-value">
              {state.calibrationResult
                ? `${(state.calibrationResult.durationMs / 1000).toFixed(1)}s`
                : '5.0s'}
            </span>
          </div>
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary" onClick={onNext}>
          Continue to Camera Setup
        </button>
      </div>
    </div>
  );
}

export default CalibrationCompleteStep;
