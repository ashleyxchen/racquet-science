/**
 * PostCalibrationCompleteStep - Shows comparison of pre/post calibration
 */

import { WizardStepProps } from '../../types/recordingWizard';

function CompareIcon() {
  return (
    <svg className="compare-icon" width="80" height="80" viewBox="0 0 24 24" fill="#0A6C3B">
      <path d="M9 3L5 7h3v7H5l4 4 4-4h-3V7h3L9 3z" />
      <path d="M15 21l4-4h-3v-7h3l-4-4-4 4h3v7h-3l4 4z" opacity="0.7" />
    </svg>
  );
}

export function PostCalibrationCompleteStep({ state, onNext }: WizardStepProps) {
  const preCalForce = state.calibrationResult?.maxForce || 0;
  const postCalForce = state.postCalibrationResult?.maxForce || state.postCalibration.maxForce;

  // Calculate change
  const forceChange = postCalForce - preCalForce;
  const percentChange = preCalForce > 0 ? ((forceChange / preCalForce) * 100) : 0;

  const getChangeMessage = () => {
    if (percentChange >= 5) return "Your grip got stronger!";
    if (percentChange <= -15) return "Your grip is fatigued";
    if (percentChange <= -5) return "Slight fatigue detected";
    return "Your grip stayed consistent!";
  };

  const getChangeColor = () => {
    if (percentChange >= 5) return '#0A6C3B';
    if (percentChange <= -15) return '#f44336';
    if (percentChange <= -5) return '#ff9800';
    return '#0A6C3B';
  };

  return (
    <div className="wizard-step post-calibration-complete-step">
      <div className="wizard-step-content centered">
        <CompareIcon />

        <h1 className="wizard-title">{getChangeMessage()}</h1>
        <p className="wizard-subtitle">Post-session calibration complete</p>

        <div className="calibration-comparison">
          <div className="comparison-row">
            <div className="comparison-item">
              <span className="comparison-label">Pre-Session</span>
              <span className="comparison-value">{preCalForce.toFixed(1)} N</span>
            </div>
            <div className="comparison-arrow">→</div>
            <div className="comparison-item">
              <span className="comparison-label">Post-Session</span>
              <span className="comparison-value">{postCalForce.toFixed(1)} N</span>
            </div>
          </div>
          <div className="comparison-change" style={{ color: getChangeColor() }}>
            {forceChange >= 0 ? '+' : ''}{forceChange.toFixed(1)} N ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(0)}%)
          </div>
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary" onClick={onNext}>
          View Session Summary
        </button>
      </div>
    </div>
  );
}

export default PostCalibrationCompleteStep;
