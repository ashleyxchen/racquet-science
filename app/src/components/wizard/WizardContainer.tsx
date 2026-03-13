/**
 * WizardContainer - Layout wrapper for wizard steps with progress indicator
 */

import { ReactNode } from 'react';
import { WizardStep } from '../../types/recordingWizard';

interface WizardContainerProps {
  currentStep: WizardStep;
  children: ReactNode;
  onBack?: () => void;
  showProgress?: boolean;
  showBackButton?: boolean;
  className?: string;
}

// Progress stages mapping
const progressStages = [
  { steps: ['finding_devices', 'devices_connected', 'devices_error'], label: 'Connect', index: 0 },
  { steps: ['duration_picker'], label: 'Duration', index: 1 },
  {
    steps: [
      'calibration_intro',
      'calibration_instructions',
      'calibration_countdown',
      'calibration_squeeze',
      'calibration_done',
      'calibration_complete',
    ],
    label: 'Calibrate',
    index: 2,
  },
  { steps: ['camera_setup_intro', 'camera_instructions', 'camera_preview'], label: 'Camera', index: 3 },
  { steps: ['recording_active'], label: 'Record', index: 4 },
];

function getProgressStage(step: WizardStep): number {
  for (const stage of progressStages) {
    if (stage.steps.includes(step)) {
      return stage.index;
    }
  }
  return 0;
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WizardContainer({
  currentStep,
  children,
  onBack,
  showProgress = true,
  showBackButton = true,
  className = '',
}: WizardContainerProps) {
  const currentStageIndex = getProgressStage(currentStep);

  // Don't show back button on certain steps
  const hideBackOnSteps: WizardStep[] = [
    'finding_devices',
    'calibration_countdown',
    'calibration_squeeze',
    'recording_active',
  ];
  const shouldShowBack = showBackButton && onBack && !hideBackOnSteps.includes(currentStep);

  return (
    <div className={`wizard-container ${className}`.trim()}>
      {/* Header with back button and progress */}
      <div className="wizard-header">
        {shouldShowBack ? (
          <button className="wizard-back-button" onClick={onBack}>
            <BackIcon />
          </button>
        ) : (
          <div className="wizard-back-placeholder" />
        )}

        {showProgress && (
          <div className="wizard-progress">
            {progressStages.map((stage, index) => (
              <div
                key={stage.label}
                className={`wizard-progress-dot ${index <= currentStageIndex ? 'active' : ''} ${
                  index < currentStageIndex ? 'completed' : ''
                }`}
              />
            ))}
          </div>
        )}

        <div className="wizard-header-spacer" />
      </div>

      {/* Content */}
      <div className="wizard-content">{children}</div>
    </div>
  );
}

export default WizardContainer;
