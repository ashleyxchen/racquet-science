/**
 * FindingDevicesStep - Shows scanning animation while looking for Watch and Racket
 */

import { WizardStepProps } from '../../types/recordingWizard';

interface FindingDevicesStepProps extends WizardStepProps {
  onDemoModeChange?: (enabled: boolean) => void;
}

function SpinnerIcon() {
  return (
    <svg className="wizard-spinner" width="64" height="64" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WatchIcon({ connected }: { connected: boolean }) {
  return (
    <div className={`device-scan-icon ${connected ? 'connected' : 'scanning'}`}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <rect x="8" y="6" width="8" height="10" rx="1" fill="white" />
        <rect x="9" y="1" width="6" height="2" rx="1" />
        <rect x="9" y="21" width="6" height="2" rx="1" />
      </svg>
      {connected && <span className="device-check">&#10003;</span>}
    </div>
  );
}

function RacketIcon({ connected }: { connected: boolean }) {
  return (
    <div className={`device-scan-icon ${connected ? 'connected' : 'scanning'}`}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="9" rx="7" ry="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="12" y1="17" x2="12" y2="23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="7" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="6" y1="9" x2="18" y2="9" stroke="currentColor" strokeWidth="1" />
        <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1" />
        <line x1="10" y1="3" x2="10" y2="15" stroke="currentColor" strokeWidth="1" />
        <line x1="14" y1="3" x2="14" y2="15" stroke="currentColor" strokeWidth="1" />
      </svg>
      {connected && <span className="device-check">&#10003;</span>}
    </div>
  );
}

export function FindingDevicesStep({ state, onDemoModeChange }: FindingDevicesStepProps) {
  const { watch, racket } = state.devices;
  const { demoMode } = state;

  const handleDemoToggle = () => {
    if (onDemoModeChange) {
      onDemoModeChange(!demoMode.racketEnabled);
    }
  };

  return (
    <div className="wizard-step finding-devices-step">
      <div className="wizard-step-content">
        <SpinnerIcon />

        <h1 className="wizard-title">Finding Devices</h1>
        <p className="wizard-subtitle">Looking for your Apple Watch and Smart Racket...</p>

        <div className="device-scan-list">
          <div className="device-scan-item">
            <WatchIcon connected={watch.isConnected} />
            <div className="device-scan-info">
              <span className="device-scan-name">Apple Watch</span>
              <span className={`device-scan-status ${watch.isConnected ? 'connected' : ''}`}>
                {watch.isConnecting ? 'Searching...' : watch.isConnected ? 'Connected' : 'Not Found'}
              </span>
            </div>
          </div>

          <div className="device-scan-item">
            <RacketIcon connected={racket.isConnected} />
            <div className="device-scan-info">
              <span className="device-scan-name">
                Smart Racket
                {demoMode.racketEnabled && <span className="demo-badge">DEMO</span>}
              </span>
              <span className={`device-scan-status ${racket.isConnected ? 'connected' : ''}`}>
                {demoMode.racketEnabled
                  ? 'Demo Mode'
                  : racket.isConnecting
                    ? 'Searching...'
                    : racket.isConnected
                      ? 'Connected'
                      : 'Not Found'}
              </span>
            </div>
          </div>
        </div>

        {/* Demo Mode Toggle */}
        <div className="demo-mode-toggle">
          <label className="toggle-label">
            <span className="toggle-text">Racket Demo Mode</span>
            <div className={`toggle-switch ${demoMode.racketEnabled ? 'active' : ''}`} onClick={handleDemoToggle}>
              <div className="toggle-slider" />
            </div>
          </label>
          <p className="toggle-hint">
            {demoMode.racketEnabled
              ? 'Using simulated racket data'
              : 'Enable to test without physical racket'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default FindingDevicesStep;
