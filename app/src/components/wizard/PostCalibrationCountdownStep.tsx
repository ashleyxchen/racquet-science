/**
 * PostCalibrationCountdownStep - Large countdown numbers 3-2-1 for post-session
 */

import { WizardStepProps } from '../../types/recordingWizard';

export function PostCalibrationCountdownStep({ state }: WizardStepProps) {
  const countdown = state.postCalibration.countdown;

  return (
    <div className="wizard-step post-calibration-countdown-step">
      <div className="wizard-step-content centered">
        <p className="countdown-label">Get Ready...</p>

        <div className="countdown-number-container">
          <span className="countdown-number" key={countdown}>
            {countdown}
          </span>
        </div>

        <p className="countdown-instruction">Prepare to squeeze!</p>
      </div>
    </div>
  );
}

export default PostCalibrationCountdownStep;
