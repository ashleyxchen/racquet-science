/**
 * CalibrationDoneStep - "All done!" with peak force value
 */

import { WizardStepProps } from '../../types/recordingWizard';

function CheckIcon() {
  return (
    <svg className="calibration-done-icon" width="100" height="100" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#0A6C3B" />
      <path
        d="M7 12l3 3 7-7"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalibrationDoneStep({ state }: WizardStepProps) {
  const maxForce = state.calibrationResult?.maxForce || state.calibration.maxForce;

  return (
    <div className="wizard-step calibration-done-step">
      <div className="wizard-step-content centered">
        <CheckIcon />

        <h1 className="wizard-title">All Done!</h1>

        <div className="peak-force-display">
          <span className="peak-force-label">Peak Force</span>
          <span className="peak-force-value">{maxForce.toFixed(1)}</span>
          <span className="peak-force-unit">N</span>
        </div>

        <p className="calibration-done-note">Great grip strength!</p>
      </div>
    </div>
  );
}

export default CalibrationDoneStep;
