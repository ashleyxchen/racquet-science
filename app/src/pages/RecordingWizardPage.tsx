/**
 * RecordingWizardPage - Main wizard page that orchestrates all steps
 *
 * NOTE: Recording orchestration is now handled by the native RecordingStateMachine.
 * This page listens to state changes and updates UI accordingly.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';

// WatchMotion plugin for recording control events
interface WatchMotionPlugin {
  addListener(
    eventName: 'recordingControl',
    callback: (data: { action: string; timestamp: number }) => void
  ): Promise<{ remove: () => void }>;
}
const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');
import { useRecordingWizard } from '../hooks/useRecordingWizard';
import { useVideoRecording } from '../hooks/useVideoRecording';
import { useRecordingSession } from '../hooks/useRecordingSession';
import { useSyncSession } from '../hooks/useSyncSession';
import { useRecordingState } from '../hooks/useRecordingState';
import { saveRecordingSession } from '../services/sessionStorage';
import { uploadCalibration } from '../services/api/sessions';
import VideoRecording from '../plugins/VideoRecording';
import {
  WizardContainer,
  FindingDevicesStep,
  DevicesConnectedStep,
  DevicesErrorStep,
  DurationPickerStep,
  CalibrationIntroStep,
  CalibrationInstructionsStep,
  CalibrationCountdownStep,
  CalibrationSqueezeStep,
  CalibrationDoneStep,
  CalibrationCompleteStep,
  CameraSetupIntroStep,
  CameraInstructionsStep,
  CameraPreviewStep,
  RecordingActiveStep,
  PostCalibrationIntroStep,
  PostCalibrationCountdownStep,
  PostCalibrationSqueezeStep,
  PostCalibrationCompleteStep,
} from '../components/wizard';

export function RecordingWizardPage() {
  const navigate = useNavigate();
  const wizard = useRecordingWizard();
  const { state } = wizard;
  const videoRecording = useVideoRecording();
  const recordingSession = useRecordingSession();
  const { syncSession, isSyncing } = useSyncSession();

  // Native state machine - single source of truth for recording state
  const recordingState = useRecordingState();

  // Track previous recording state to detect when recording stops
  const wasRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);
  // Track preview state with ref to avoid stale closure in cleanup
  const isPreviewingRef = useRef(false);
  // Store recording result for use after post-calibration
  const recordingResultRef = useRef<any>(null);
  // Store backend session ID after immediate sync
  const backendSessionIdRef = useRef<number | undefined>(undefined);

  // Start device scan on mount
  useEffect(() => {
    wizard.startDeviceScan();
  }, []);

  // Keep preview ref in sync with state (avoids stale closure in cleanup)
  useEffect(() => {
    isPreviewingRef.current = videoRecording.isPreviewing;
  }, [videoRecording.isPreviewing]);

  // Detect when recording stops (e.g., from Watch or state machine)
  // NOTE: We now watch BOTH wizard state AND native state machine
  useEffect(() => {
    // Use state machine as authoritative source when available, fallback to wizard state
    const isRecording = recordingState.isRecording || state.recording.isRecording;

    // Check if state machine has fully stopped (idle with video path available)
    const stateMachineFullyStopped = recordingState.state === 'idle' && !recordingState.isRecording;

    console.log('[RecordingWizardPage] Recording state check:', {
      wizardIsRecording: state.recording.isRecording,
      stateMachineIsRecording: recordingState.isRecording,
      stateMachineState: recordingState.state,
      stateMachineVideoPath: recordingState.context.videoPath,
      wasRecording: wasRecordingRef.current,
      currentStep: state.currentStep,
    });

    // If we were recording and state machine has fully stopped (idle), handle stop
    // We wait for 'idle' state to ensure video path is available in context
    if (wasRecordingRef.current && stateMachineFullyStopped && state.currentStep === 'recording_active') {
      console.log('[RecordingWizardPage] Recording stopped externally, stopping and saving...');

      // Handle external stop (e.g., from Watch or native stop button)
      const handleExternalStop = async () => {
        // Prevent double-stopping
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;

        console.log('[RecordingWizardPage] handleExternalStop - starting parallel stop...');
        // Webview alpha is already 0 (set when preview started), so no flash during transition

        try {
          // CRITICAL: Stop preview FIRST (in parallel) to unblock UI immediately
          // This ensures the camera overlay is removed even if video stop hangs
          const previewStopPromise = videoRecording.forceStopPreview().catch((err) => {
            console.error('[RecordingWizardPage] Preview stop error (non-blocking):', err);
          });

          // Get video path from state machine context (state machine already handled video stop)
          const videoPath = recordingState.context.videoPath;
          console.log('[RecordingWizardPage] External stop - video path from state machine:', videoPath);

          // Stop recording session with timeout to prevent hanging
          // Pass video path from state machine since it handles video orchestration
          const recordingStopPromise = Promise.race([
            recordingSession.stopRecording(videoPath),
            new Promise<null>((resolve) => {
              setTimeout(() => {
                console.warn('[RecordingWizardPage] Recording stop timed out after 5s');
                resolve(null);
              }, 5000); // 5 second timeout
            }),
          ]);

          // Wait for both in parallel
          const [, result] = await Promise.all([previewStopPromise, recordingStopPromise]);

          console.log('[RecordingWizardPage] External stop - preview and recording stopped');

          // Save and sync, then go to post-calibration
          if (result) {
            console.log('[RecordingWizardPage] External stop - saving session:', {
              sessionId: result.sessionId,
              videoPath: result.videoPath,
            });

            // Save to local storage first
            try {
              await saveRecordingSession(result);
              console.log('[RecordingWizardPage] Session saved locally (external stop)');
            } catch (saveErr) {
              console.error('[RecordingWizardPage] Failed to save locally:', saveErr);
            }

            // Store result in ref for use after post-calibration
            recordingResultRef.current = result;

            // Sync to backend immediately (POST session data)
            try {
              console.log('[RecordingWizardPage] External stop - syncing to backend...');
              const syncResult = await syncSession(result, {
                metadata: {
                  local_session_id: result.sessionId,
                  stateMachineVideoPath: videoPath || result.videoPath,
                },
                plannedDuration: state.plannedDuration,
                recordingStartedBy: state.recording.startedBy || 'phone',
                calibrationData: state.calibrationResult || undefined,
              });
              if (syncResult.success) {
                backendSessionIdRef.current = syncResult.backendSessionId;
                console.log('[RecordingWizardPage] Session synced (external stop):', syncResult.backendSessionId);
              } else {
                console.error('[RecordingWizardPage] Sync failed (external stop):', syncResult.error);
              }
            } catch (syncErr) {
              console.error('[RecordingWizardPage] Failed to sync:', syncErr);
            }

            // Go to post-calibration intro (same flow as regular stop)
            wizard.goToStep('post_calibration_intro');
          } else {
            // Recording result is null (timeout or error) - still go to post-calibration
            // but with limited data
            console.warn('[RecordingWizardPage] External stop - recording result unavailable, continuing to post-calibration');
            wizard.goToStep('post_calibration_intro');
          }
        } finally {
          isStoppingRef.current = false;
        }
      };

      handleExternalStop();
    }

    // Update ref for next render - track if we're still recording
    // IMPORTANT: Only update to false when state machine is fully stopped (idle)
    // This prevents the ref from being set to false during 'stopping' transition
    // which would cause the external stop handler to never trigger
    if (isRecording) {
      wasRecordingRef.current = true;
    } else if (recordingState.state === 'idle' || recordingState.state === 'error') {
      // Only clear the ref when state machine has fully stopped
      wasRecordingRef.current = false;
    }
    // Note: When state is 'stopping', we keep wasRecordingRef.current as true
  }, [state.recording.isRecording, recordingState.isRecording, recordingState.state, recordingState.context.videoPath, state.currentStep, navigate, recordingSession, syncSession, state.plannedDuration, state.recording.startedBy, state.calibrationResult, state.sessionId, wizard, videoRecording, recordingState.context]);

  // Start/stop camera preview based on current step
  useEffect(() => {
    const previewSteps = ['camera_preview', 'recording_active'];
    const shouldShowPreview = previewSteps.includes(state.currentStep);

    console.log('[RecordingWizardPage] Step changed:', state.currentStep, 'shouldShowPreview:', shouldShowPreview, 'isPreviewing:', videoRecording.isPreviewing);

    if (shouldShowPreview && !videoRecording.isPreviewing) {
      console.log('[RecordingWizardPage] Starting preview...');
      videoRecording.startPreview().then(() => {
        // Update overlay with current duration
        videoRecording.updateOverlay({ durationMinutes: state.plannedDuration });
      });
    } else if (!shouldShowPreview && videoRecording.isPreviewing) {
      console.log('[RecordingWizardPage] Stopping preview...');
      videoRecording.stopPreview();
    }
    // Note: No cleanup here - we rely on:
    // 1. forceStopPreview() called before navigation in stop handlers
    // 2. Safety net unmount effect below
  }, [state.currentStep]);

  // Safety net: Always ensure preview is stopped when component unmounts
  useEffect(() => {
    return () => {
      console.log('[RecordingWizardPage] Component unmounting - ensuring preview is stopped');
      // Always call ensurePreviewStopped on unmount as a safety net
      VideoRecording.ensurePreviewStopped().catch(console.error);
    };
  }, []); // Empty deps - only runs on unmount

  // Use refs to access current state in the listener callback (avoids stale closures)
  const stateRef = useRef(state);
  const wizardRef = useRef(wizard);
  const recordingSessionRef = useRef(recordingSession);

  // Keep refs in sync with current values
  useEffect(() => {
    stateRef.current = state;
    wizardRef.current = wizard;
    recordingSessionRef.current = recordingSession;
  }, [state, wizard, recordingSession]);

  // Listen for recording control events from Watch (START/STOP)
  // Registered once on mount, uses refs to access current state
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | null = null;

    const setupListener = async () => {
      try {
        listenerHandle = await WatchMotion.addListener('recordingControl', (data) => {
          console.log('🎮🚨🚨🚨 [RecordingWizardPage] Received recordingControl from Watch!', data);

          const currentState = stateRef.current;
          const currentWizard = wizardRef.current;
          const currentRecordingSession = recordingSessionRef.current;

          console.log('🎮 Current state:', {
            isRecording: currentState.recording.isRecording,
            currentStep: currentState.currentStep,
          });

          if (data.action === 'STOP' && currentState.recording.isRecording) {
            console.log('🎮🛑 [RecordingWizardPage] Watch requested STOP - triggering wizard.stopRecording()...');
            // Update wizard state to stop recording
            // This will trigger the external stop detection effect above
            currentWizard.stopRecording();
            console.log('🎮🛑 [RecordingWizardPage] wizard.stopRecording() called - waiting for effect to trigger...');
          } else if (data.action === 'START' && !currentState.recording.isRecording && currentState.currentStep === 'camera_preview') {
            console.log('🎮▶️ [RecordingWizardPage] Watch requested START - triggering start flow');
            // Start recording (same as tapping Start on phone)
            currentWizard.startRecording('watch');
            const arduinoDeviceId = currentState.devices.racket.deviceId || undefined;
            const wizardSessionId = currentState.sessionId;
            const plannedDuration = currentState.plannedDuration;
            // Pass true for stateMachineHandlesVideo - state machine orchestrates video
            currentRecordingSession.startRecording(arduinoDeviceId, wizardSessionId, plannedDuration, true).catch(console.error);
          } else {
            console.warn('🎮⚠️ [RecordingWizardPage] recordingControl action not handled:', {
              action: data.action,
              isRecording: currentState.recording.isRecording,
              currentStep: currentState.currentStep,
            });
          }
        });
        console.log('[RecordingWizardPage] recordingControl listener registered successfully');
      } catch (err) {
        console.error('[RecordingWizardPage] Failed to register recordingControl listener:', err);
      }
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
        console.log('[RecordingWizardPage] recordingControl listener removed');
      }
    };
  }, []); // Empty deps - register once on mount, never re-register

  // Listen for native start button tap on camera overlay
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let startButtonListener: { remove: () => void } | null = null;

    const setupListener = async () => {
      try {
        startButtonListener = await VideoRecording.addListener('startButtonTapped', (data) => {
          console.log('▶️▶️▶️ [RecordingWizardPage] Native start button tapped!', data);

          const currentState = stateRef.current;
          const currentWizard = wizardRef.current;
          const currentRecordingSession = recordingSessionRef.current;

          console.log('▶️ Current state:', {
            isRecording: currentState.recording.isRecording,
            currentStep: currentState.currentStep,
          });

          // Only start if we're on the camera preview step and not already recording
          if (!currentState.recording.isRecording && currentState.currentStep === 'camera_preview') {
            console.log('▶️ [RecordingWizardPage] Native start button - triggering start flow...');

            // Start wizard recording state
            currentWizard.startRecording('phone');

            // Start sensor data collection (which also handles video recording internally)
            const arduinoDeviceId = currentState.devices.racket.deviceId || undefined;
            const wizardSessionId = currentState.sessionId;
            const plannedDuration = currentState.plannedDuration;
            console.log('[RecordingWizardPage] Starting recording with wizard sessionId:', wizardSessionId, 'duration:', plannedDuration);
            // Pass true for stateMachineHandlesVideo - state machine orchestrates video
            currentRecordingSession.startRecording(arduinoDeviceId, wizardSessionId, plannedDuration, true).catch(console.error);

            console.log('▶️ [RecordingWizardPage] Recording start triggered from native button');
          } else {
            console.warn('▶️ [RecordingWizardPage] Native start button pressed but not on camera_preview or already recording!', {
              isRecording: currentState.recording.isRecording,
              currentStep: currentState.currentStep,
            });
          }
        });
        console.log('[RecordingWizardPage] startButtonTapped listener registered successfully');
      } catch (err) {
        console.error('[RecordingWizardPage] Failed to register startButtonTapped listener:', err);
      }
    };

    setupListener();

    return () => {
      if (startButtonListener) {
        startButtonListener.remove();
        console.log('[RecordingWizardPage] startButtonTapped listener removed');
      }
    };
  }, []); // Empty deps - register once on mount

  // Listen for native close button tap on camera overlay (exit camera view)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let closeButtonListener: { remove: () => void } | null = null;

    const setupListener = async () => {
      try {
        closeButtonListener = await VideoRecording.addListener('closeButtonTapped', (data) => {
          console.log('✕ [RecordingWizardPage] Native close button tapped!', data);

          const currentState = stateRef.current;

          // Only allow closing if not recording
          if (!currentState.recording.isRecording) {
            console.log('✕ [RecordingWizardPage] Exiting camera view...');
            // Stop preview and navigate back
            videoRecording.forceStopPreview().then(() => {
              navigate('/');
            });
          } else {
            console.warn('✕ [RecordingWizardPage] Cannot close while recording!');
          }
        });
        console.log('[RecordingWizardPage] closeButtonTapped listener registered successfully');
      } catch (err) {
        console.error('[RecordingWizardPage] Failed to register closeButtonTapped listener:', err);
      }
    };

    setupListener();

    return () => {
      if (closeButtonListener) {
        closeButtonListener.remove();
        console.log('[RecordingWizardPage] closeButtonTapped listener removed');
      }
    };
  }, []); // Empty deps - register once on mount

  // Listen for native stop button tap on camera overlay
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let stopButtonListener: { remove: () => void } | null = null;

    const setupListener = async () => {
      try {
        stopButtonListener = await VideoRecording.addListener('stopButtonTapped', (data) => {
          console.log('🛑🛑🛑 [RecordingWizardPage] Native stop button tapped!', data);

          const currentState = stateRef.current;
          const currentWizard = wizardRef.current;

          console.log('🛑 Current state:', {
            isRecording: currentState.recording.isRecording,
            currentStep: currentState.currentStep,
          });

          if (currentState.recording.isRecording) {
            console.log('🛑 [RecordingWizardPage] Native stop button - triggering wizard.stopRecording()...');
            // Update wizard state to stop recording
            // This will trigger the external stop detection effect above
            currentWizard.stopRecording();
            console.log('🛑 [RecordingWizardPage] wizard.stopRecording() called - waiting for effect to trigger...');
          } else {
            console.warn('🛑 [RecordingWizardPage] Native stop button pressed but not recording!');
          }
        });
        console.log('[RecordingWizardPage] stopButtonTapped listener registered successfully');
      } catch (err) {
        console.error('[RecordingWizardPage] Failed to register stopButtonTapped listener:', err);
      }
    };

    setupListener();

    return () => {
      if (stopButtonListener) {
        stopButtonListener.remove();
        console.log('[RecordingWizardPage] stopButtonTapped listener removed');
      }
    };
  }, []); // Empty deps - register once on mount

  // Update native overlay when entering/exiting recording mode
  useEffect(() => {
    if (state.currentStep === 'recording_active') {
      videoRecording.setRecordingMode(true);
    } else if (state.currentStep === 'camera_preview') {
      videoRecording.setRecordingMode(false);
    }
  }, [state.currentStep]);

  // Handle back navigation
  const handleBack = () => {
    // These steps should navigate back to home
    const exitSteps = ['finding_devices', 'devices_connected', 'devices_error'];
    if (exitSteps.includes(state.currentStep)) {
      navigate('/');
      return;
    }

    // Special handling for calibration steps
    // If user goes back during/after calibration data collection, reset and go to calibration intro
    const calibrationInProgressSteps = [
      'calibration_countdown',
      'calibration_squeeze',
      'calibration_done',
      'calibration_complete',
    ];

    if (calibrationInProgressSteps.includes(state.currentStep)) {
      // Reset calibration data and go back to calibration intro
      wizard.resetCalibration();
      wizard.goToStep('calibration_intro');
      return;
    }

    // Default: normal back navigation
    wizard.goBack();
  };

  // Handle completion of post-calibration (or skip)
  const handlePostCalibrationComplete = useCallback(async () => {
    const result = recordingResultRef.current;
    // Session was already synced immediately after recording stopped
    const backendSessionId = backendSessionIdRef.current;

    if (result) {
      console.log('[RecordingWizardPage] Post-calibration complete, preparing navigation...', {
        sessionId: result.sessionId,
        backendSessionId,
        hasPostCalibration: !!state.postCalibrationResult,
      });

      // If we have post-calibration data and a backend session, upload just the calibration
      if (state.postCalibrationResult && backendSessionId) {
        try {
          await uploadCalibration(backendSessionId, {
            max_force: state.postCalibrationResult.maxForce,
            timestamp: new Date(state.postCalibrationResult.timestamp).toISOString(),
            duration_ms: state.postCalibrationResult.durationMs,
            is_post_session: true,
            samples: state.postCalibrationResult.samples?.map(s => ({
              timestamp: s.timestamp,
              force: s.force,
              accel_x: s.accel?.x,
              accel_y: s.accel?.y,
              accel_z: s.accel?.z,
              gyro_x: s.gyro?.x,
              gyro_y: s.gyro?.y,
              gyro_z: s.gyro?.z,
            })),
          });
          console.log('[RecordingWizardPage] Post-calibration data uploaded');
        } catch (err) {
          console.error('[RecordingWizardPage] Failed to upload post-calibration:', err);
        }
      }

      // Navigate to session summary with route state
      navigate('/session-summary', {
        state: {
          sessionId: result.sessionId,
          startTime: result.startTime,
          duration: result.duration,
          videoPath: result.videoPath,
          watchSampleCount: result.sensorSamples.length,
          arduinoSampleCount: result.arduinoSamples.length,
          fsrFrameCount: result.fsrSamples.length,
          painNoteCount: result.painNotes.length,
          backendSessionId,
        },
      });
    } else {
      // No recording result - use fallback data from wizard state
      console.warn('[RecordingWizardPage] Post-calibration complete - no recording result, using fallback');

      const fallbackStartTime = state.recording.startTime || (Date.now() - (state.plannedDuration * 60 * 1000));
      const fallbackDuration = state.recording.startTime
        ? Date.now() - state.recording.startTime
        : state.plannedDuration * 60 * 1000;

      // Web mode uses mock counts for testing
      const isWeb = !Capacitor.isNativePlatform();

      navigate('/session-summary', {
        state: {
          sessionId: state.sessionId || uuidv4(),
          startTime: fallbackStartTime,
          duration: fallbackDuration,
          videoPath: null,
          watchSampleCount: isWeb ? 1234 : 0,
          arduinoSampleCount: isWeb ? 892 : 0,
          fsrFrameCount: isWeb ? 456 : 0,
          painNoteCount: isWeb ? 2 : 0,
          backendSessionId,
          recordingIncomplete: !isWeb, // Flag for native to indicate data may be incomplete
        },
      });
    }
  }, [navigate, state.plannedDuration, state.postCalibrationResult, state.sessionId, state.recording.startTime]);

  // Create step props
  const stepProps = {
    state,
    onNext: wizard.goNext,
    onBack: handleBack,
    onRetry: wizard.retryDeviceConnection,
  };

  // Render current step
  const renderStep = () => {
    switch (state.currentStep) {
      case 'finding_devices':
        return (
          <FindingDevicesStep
            {...stepProps}
            onDemoModeChange={wizard.setRacketDemoMode}
          />
        );

      case 'devices_connected':
        return <DevicesConnectedStep {...stepProps} />;

      case 'devices_error':
        return <DevicesErrorStep {...stepProps} />;

      case 'duration_picker':
        return (
          <DurationPickerStep
            {...stepProps}
            onDurationChange={wizard.setDuration}
          />
        );

      case 'calibration_intro':
        return <CalibrationIntroStep {...stepProps} />;

      case 'calibration_instructions':
        return (
          <CalibrationInstructionsStep
            {...stepProps}
            onStartCalibration={wizard.startCalibrationSequence}
          />
        );

      case 'calibration_countdown':
        return <CalibrationCountdownStep {...stepProps} />;

      case 'calibration_squeeze':
        return <CalibrationSqueezeStep {...stepProps} />;

      case 'calibration_done':
        return <CalibrationDoneStep {...stepProps} />;

      case 'calibration_complete':
        return <CalibrationCompleteStep {...stepProps} />;

      case 'camera_setup_intro':
        return <CameraSetupIntroStep {...stepProps} />;

      case 'camera_instructions':
        return <CameraInstructionsStep {...stepProps} />;

      case 'camera_preview':
        return (
          <CameraPreviewStep
            {...stepProps}
            onStartRecording={async (startedBy) => {
              // Start wizard recording state
              await wizard.startRecording(startedBy);

              // Start sensor data collection (which also handles video recording internally)
              // IMPORTANT: Pass wizard's sessionId to ensure Watch, video, and all sensors use the same ID
              try {
                const arduinoDeviceId = state.devices.racket.deviceId || undefined;
                const wizardSessionId = state.sessionId; // Use wizard's sessionId for consistency
                const plannedDuration = state.plannedDuration; // Pass to Watch for time remaining notifications
                console.log('[RecordingWizardPage] Starting recording with wizard sessionId:', wizardSessionId, 'duration:', plannedDuration);
                // Pass true for stateMachineHandlesVideo - state machine orchestrates video start/stop
                await recordingSession.startRecording(arduinoDeviceId, wizardSessionId, plannedDuration, true);
                console.log('[RecordingWizardPage] Recording session started (sensors only, video handled by state machine)');
              } catch (err) {
                console.error('[RecordingWizardPage] Failed to start recording session:', err);
              }
            }}
            onSwitchCamera={videoRecording.switchCamera}
            cameraPosition={videoRecording.cameraPosition}
          />
        );

      case 'recording_active':
        return (
          <RecordingActiveStep
            {...stepProps}
            onStopRecording={async () => {
              // Prevent double-stopping
              if (isStoppingRef.current) return;
              isStoppingRef.current = true;

              try {
                // Stop wizard/state machine FIRST to get video path
                // State machine handles video stop and returns the path
                console.log('[RecordingWizardPage] Stopping via state machine...');
                const wizardResult = await wizard.stopRecording();
                const videoPath = wizardResult?.videoPath;
                console.log('[RecordingWizardPage] State machine stopped, videoPath:', videoPath);

                // Stop recording session (sensors only, pass video path from state machine)
                console.log('[RecordingWizardPage] Stopping recording session...');
                const result = await recordingSession.stopRecording(videoPath);

                // Force stop preview BEFORE navigation to prevent orphaned preview
                await videoRecording.forceStopPreview();

                // Save session data for later use in post-calibration completion
                if (result) {
                  console.log('[RecordingWizardPage] Recording stopped, saving session...', {
                    sessionId: result.sessionId,
                    videoPath: result.videoPath,
                    sensorSamples: result.sensorSamples.length,
                  });

                  // Save to local storage first
                  try {
                    await saveRecordingSession(result);
                    console.log('[RecordingWizardPage] Session saved locally');
                  } catch (saveErr) {
                    console.error('[RecordingWizardPage] Failed to save locally:', saveErr);
                  }

                  // Store result in ref for use after post-calibration
                  recordingResultRef.current = result;

                  // IMPORTANT: Sync to backend immediately after recording stops
                  // This ensures the session exists before SessionSummaryPage tries to update it
                  try {
                    console.log('[RecordingWizardPage] Syncing session to backend immediately...');
                    const syncResult = await syncSession(result, {
                      metadata: {
                        local_session_id: result.sessionId,
                        stateMachineVideoPath: result.videoPath,
                      },
                      plannedDuration: state.plannedDuration,
                      recordingStartedBy: state.recording.startedBy || 'phone',
                      calibrationData: state.calibrationResult || undefined,
                    });
                    if (syncResult.success) {
                      backendSessionIdRef.current = syncResult.backendSessionId;
                      console.log('[RecordingWizardPage] Session synced to backend:', syncResult.backendSessionId);
                    } else {
                      console.error('[RecordingWizardPage] Sync failed:', syncResult.error);
                    }
                  } catch (syncErr) {
                    console.error('[RecordingWizardPage] Failed to sync session:', syncErr);
                  }
                }

                // Go to post-calibration intro instead of navigating away
                wizard.goToStep('post_calibration_intro');

              } finally {
                isStoppingRef.current = false;
              }
            }}
            onUpdateOverlay={(options) => videoRecording.updateOverlay(options)}
          />
        );

      // Post-calibration steps
      case 'post_calibration_intro':
        return (
          <PostCalibrationIntroStep
            {...stepProps}
            onNext={wizard.startPostCalibrationSequence}
            onSkip={() => handlePostCalibrationComplete()}
          />
        );

      case 'post_calibration_countdown':
        return <PostCalibrationCountdownStep {...stepProps} />;

      case 'post_calibration_squeeze':
        return <PostCalibrationSqueezeStep {...stepProps} />;

      case 'post_calibration_complete':
        return (
          <PostCalibrationCompleteStep
            {...stepProps}
            onNext={() => handlePostCalibrationComplete()}
          />
        );

      default:
        return <FindingDevicesStep {...stepProps} />;
    }
  };

  // Determine if we should show progress
  const showProgress = ![
    'calibration_countdown',
    'calibration_squeeze',
    'calibration_done',
    'recording_active',
    'post_calibration_countdown',
    'post_calibration_squeeze',
  ].includes(state.currentStep);

  // Add class when camera preview is active for transparent background
  const containerClassName = videoRecording.isPreviewing ? 'camera-preview-active' : '';

  return (
    <WizardContainer
      currentStep={state.currentStep}
      onBack={handleBack}
      showProgress={showProgress}
      className={containerClassName}
    >
      {renderStep()}
    </WizardContainer>
  );
}

export default RecordingWizardPage;
