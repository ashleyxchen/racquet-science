/**
 * CalibrationSqueezeStep - "Squeeeeeeze!" with circular progress
 */

import { WizardStepProps } from '../../types/recordingWizard';

interface CircularProgressProps {
  progress: number; // 1-5
  maxProgress: number;
}

function CircularProgress({ progress, maxProgress }: CircularProgressProps) {
  const radius = 80;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const progressPercent = progress / maxProgress;
  const strokeDashoffset = circumference * (1 - progressPercent);

  return (
    <svg className="squeeze-progress-ring" width="200" height="200" viewBox="0 0 200 200">
      {/* Background circle */}
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke="#e0e0e0"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke="#E0FF2D"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 100 100)"
        style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
      />
      {/* Center text */}
      <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" className="squeeze-progress-text">
        {progress}
      </text>
    </svg>
  );
}

export function CalibrationSqueezeStep({ state }: WizardStepProps) {
  const { squeezeProgress, maxForce } = state.calibration;

  return (
    <div className="wizard-step calibration-squeeze-step">
      <div className="wizard-step-content centered">
        <h1 className="squeeze-title">Squeeeeeeze!</h1>

        <CircularProgress progress={squeezeProgress} maxProgress={5} />

        <p className="squeeze-instruction">Keep squeezing as hard as you can!</p>

        <div className="force-indicator">
          <span className="force-label">Current Force</span>
          <span className="force-value">{maxForce.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

export default CalibrationSqueezeStep;
