/**
 * DevicesErrorStep - Error state when device not found
 */

import { WizardStepProps } from '../../types/recordingWizard';

function ErrorIcon() {
  return (
    <svg className="error-icon" width="80" height="80" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F44336" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DevicesErrorStep({ state, onRetry, onBack }: WizardStepProps) {
  const { watch, racket } = state.devices;

  const watchError = !watch.isConnected;
  const racketError = !racket.isConnected;

  return (
    <div className="wizard-step devices-error-step">
      <div className="wizard-step-content">
        <ErrorIcon />

        <h1 className="wizard-title">Connection Failed</h1>
        <p className="wizard-subtitle">
          {watchError && racketError
            ? "We couldn't find your devices"
            : watchError
            ? "We couldn't find your Apple Watch"
            : "We couldn't find your Smart Racket"}
        </p>

        <div className="error-details">
          {watchError && (
            <div className="error-item">
              <span className="error-device">Apple Watch</span>
              <span className="error-message">{watch.error || 'Not found'}</span>
            </div>
          )}
          {racketError && (
            <div className="error-item">
              <span className="error-device">Smart Racket</span>
              <span className="error-message">{racket.error || 'Not found'}</span>
            </div>
          )}
        </div>

        <div className="troubleshooting-tips">
          <p className="tips-title">Try the following:</p>
          <ul className="tips-list">
            <li>Make sure your devices are turned on</li>
            <li>Check that Bluetooth is enabled</li>
            <li>Ensure your Apple Watch is paired with this iPhone</li>
            <li>Move closer to your Smart Racket</li>
          </ul>
        </div>
      </div>

      <div className="wizard-actions">
        <button className="wizard-button primary" onClick={onRetry}>
          Try Again
        </button>
        <button className="wizard-button secondary" onClick={onBack}>
          Go Back
        </button>
      </div>
    </div>
  );
}

export default DevicesErrorStep;
