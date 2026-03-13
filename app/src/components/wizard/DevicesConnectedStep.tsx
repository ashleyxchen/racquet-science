/**
 * DevicesConnectedStep - Success state showing both devices connected
 */

import { WizardStepProps } from '../../types/recordingWizard';

function CheckCircleIcon() {
  return (
    <svg className="success-icon" width="80" height="80" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#0A6C3B" />
      <path
        d="M9 12l2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DevicesConnectedStep({ state, onNext }: WizardStepProps) {
  const { watch, racket } = state.devices;
  const { demoMode } = state;

  return (
    <div className="wizard-step devices-connected-step">
      <div className="wizard-step-content">
        <CheckCircleIcon />

        <h1 className="wizard-title">Devices Connected</h1>
        <p className="wizard-subtitle">Your devices are ready to record</p>

        <div className="connected-devices-list">
          <div className="connected-device-item">
            <div className="connected-device-dot" />
            <div className="connected-device-info">
              <span className="connected-device-name">{watch.name || 'Apple Watch'}</span>
              <span className="connected-device-type">Watch</span>
            </div>
          </div>

          <div className="connected-device-item">
            <div className="connected-device-dot" style={demoMode.racketEnabled ? { background: '#E0FF2D' } : undefined} />
            <div className="connected-device-info">
              <span className="connected-device-name">
                {racket.name || 'Smart Racket'}
                {demoMode.racketEnabled && <span className="demo-badge">DEMO</span>}
              </span>
              <span className="connected-device-type">
                {demoMode.racketEnabled ? 'Simulated' : 'Racket'}
              </span>
            </div>
          </div>
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

export default DevicesConnectedStep;
