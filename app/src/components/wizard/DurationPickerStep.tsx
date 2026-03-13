/**
 * DurationPickerStep - Slider to select session duration (5-60 minutes)
 */

import { WizardStepProps, DEFAULT_DURATION_CONFIG } from '../../types/recordingWizard';

interface DurationPickerStepProps extends WizardStepProps {
  onDurationChange: (minutes: number) => void;
}

function ClockIcon() {
  return (
    <svg className="duration-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#0A6C3B" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

export function DurationPickerStep({ state, onNext, onDurationChange }: DurationPickerStepProps) {
  const { minMinutes, maxMinutes } = DEFAULT_DURATION_CONFIG;
  const duration = state.plannedDuration;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDurationChange(parseInt(e.target.value, 10));
  };

  // Calculate slider fill percentage
  const fillPercent = ((duration - minMinutes) / (maxMinutes - minMinutes)) * 100;

  return (
    <div className="wizard-step duration-picker-step">
      <div className="wizard-step-content">
        <ClockIcon />

        <h1 className="wizard-title">Session Duration</h1>
        <p className="wizard-subtitle">How long do you plan to play?</p>

        <div className="duration-display">
          <span className="duration-value">{duration}</span>
          <span className="duration-unit">minutes</span>
        </div>

        <div className="duration-slider-container">
          <input
            type="range"
            min={minMinutes}
            max={maxMinutes}
            step={5}
            value={duration}
            onChange={handleSliderChange}
            className="duration-slider"
            style={{
              background: `linear-gradient(to right, #0A6C3B 0%, #0A6C3B ${fillPercent}%, #e0e0e0 ${fillPercent}%, #e0e0e0 100%)`,
            }}
          />
          <div className="duration-labels">
            <span>{minMinutes} min</span>
            <span>{maxMinutes} min</span>
          </div>
        </div>

        <div className="duration-presets">
          {[15, 30, 45, 60].map((preset) => (
            <button
              key={preset}
              className={`duration-preset ${duration === preset ? 'active' : ''}`}
              onClick={() => onDurationChange(preset)}
            >
              {preset}m
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default DurationPickerStep;
