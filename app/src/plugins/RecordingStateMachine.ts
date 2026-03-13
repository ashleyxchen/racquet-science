/**
 * RecordingStateMachine Capacitor Plugin
 *
 * TypeScript interface for the native iOS RecordingStateMachine
 * This is the SINGLE SOURCE OF TRUTH for recording state
 */

import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

// MARK: - Types

export type RecordingStateValue = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';
export type RecordingStartedBy = 'phone' | 'watch' | 'unknown';

export interface RecordingContext {
  sessionId?: string;
  startTime?: number; // Unix timestamp ms
  plannedDuration: number; // minutes
  startedBy: RecordingStartedBy;
  arduinoDeviceId?: string;
  videoReady: boolean;
  watchReady: boolean;
  arduinoReady: boolean;
  errorMessage?: string;
  videoPath?: string;
  videoDurationMs?: number;
}

export interface RecordingStateInfo {
  state: RecordingStateValue;
  context: RecordingContext;
}

export interface StateChangedEvent {
  previousState: RecordingStateValue;
  state: RecordingStateValue;
  context: RecordingContext;
  timestamp: number;
}

export interface RequestStartOptions {
  sessionId: string;
  arduinoDeviceId?: string;
  plannedDuration?: number; // minutes, default 30
  startedBy?: RecordingStartedBy; // default 'phone'
}

export interface RequestStartResult {
  success: boolean;
  error?: string;
  state: RecordingStateValue;
}

export interface RequestStopResult {
  success: boolean;
  error?: string;
  state: RecordingStateValue;
  result?: RecordingContext;
}

export interface AcknowledgeErrorResult {
  success: boolean;
  state: RecordingStateValue;
}

export interface ForceResetResult {
  success: boolean;
  state: RecordingStateValue;
}

// MARK: - Plugin Interface

export interface RecordingStateMachinePlugin {
  /**
   * Get current state and context
   */
  getState(): Promise<RecordingStateInfo>;

  /**
   * Request to start recording
   * Transitions: IDLE → STARTING → RECORDING
   */
  requestStart(options: RequestStartOptions): Promise<RequestStartResult>;

  /**
   * Request to stop recording
   * Transitions: RECORDING → STOPPING → IDLE
   * Enforces minimum duration (3 seconds)
   */
  requestStop(): Promise<RequestStopResult>;

  /**
   * Acknowledge and clear error state
   * Transitions: ERROR → IDLE
   */
  acknowledgeError(): Promise<AcknowledgeErrorResult>;

  /**
   * Force reset to idle state (for recovery)
   * Transitions: ANY → IDLE
   */
  forceReset(): Promise<ForceResetResult>;

  /**
   * Add listener for state change events
   */
  addListener(
    eventName: 'stateChanged',
    listenerFunc: (event: StateChangedEvent) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

// MARK: - Plugin Registration

const RecordingStateMachine = registerPlugin<RecordingStateMachinePlugin>('RecordingStateMachine', {
  web: () => import('./RecordingStateMachineWeb').then((m) => new m.RecordingStateMachineWeb()),
});

export default RecordingStateMachine;
