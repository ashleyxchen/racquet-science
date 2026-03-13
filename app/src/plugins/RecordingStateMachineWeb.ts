/**
 * RecordingStateMachine Web Implementation
 *
 * Mock implementation for web development and testing
 */

import { WebPlugin } from '@capacitor/core';
import type {
  RecordingStateMachinePlugin,
  RecordingStateInfo,
  RecordingStateValue,
  RecordingContext,
  RequestStartOptions,
  RequestStartResult,
  RequestStopResult,
  AcknowledgeErrorResult,
  ForceResetResult,
  StateChangedEvent,
} from './RecordingStateMachine';

export class RecordingStateMachineWeb extends WebPlugin implements RecordingStateMachinePlugin {
  private state: RecordingStateValue = 'idle';
  private context: RecordingContext = {
    plannedDuration: 30,
    startedBy: 'unknown',
    videoReady: false,
    watchReady: false,
    arduinoReady: false,
  };

  private emitStateChange(previousState: RecordingStateValue) {
    const event: StateChangedEvent = {
      previousState,
      state: this.state,
      context: { ...this.context },
      timestamp: Date.now(),
    };
    this.notifyListeners('stateChanged', event);
  }

  async getState(): Promise<RecordingStateInfo> {
    return {
      state: this.state,
      context: { ...this.context },
    };
  }

  async requestStart(options: RequestStartOptions): Promise<RequestStartResult> {
    console.log('[RecordingStateMachineWeb] requestStart:', options);

    if (this.state !== 'idle') {
      return {
        success: false,
        error: `Cannot start: current state is ${this.state}`,
        state: this.state,
      };
    }

    const previousState = this.state;

    // Initialize context
    this.context = {
      sessionId: options.sessionId,
      plannedDuration: options.plannedDuration ?? 30,
      startedBy: options.startedBy ?? 'phone',
      arduinoDeviceId: options.arduinoDeviceId,
      videoReady: false,
      watchReady: false,
      arduinoReady: !options.arduinoDeviceId, // No Arduino = already ready
    };

    // Transition to STARTING
    this.state = 'starting';
    this.emitStateChange(previousState);

    // Simulate sensor initialization
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate sensors becoming ready
    this.context.videoReady = true;
    this.context.watchReady = true;
    this.context.arduinoReady = true;
    this.context.startTime = Date.now();

    // Transition to RECORDING
    const startingState = this.state;
    this.state = 'recording';
    this.emitStateChange(startingState);

    return {
      success: true,
      state: this.state,
    };
  }

  async requestStop(): Promise<RequestStopResult> {
    console.log('[RecordingStateMachineWeb] requestStop');

    if (this.state !== 'recording') {
      return {
        success: false,
        error: `Cannot stop: current state is ${this.state}`,
        state: this.state,
      };
    }

    // Check minimum duration
    if (this.context.startTime) {
      const elapsed = Date.now() - this.context.startTime;
      if (elapsed < 3000) {
        return {
          success: false,
          error: `Recording too short. Wait ${3000 - elapsed}ms more.`,
          state: this.state,
        };
      }
    }

    const previousState = this.state;

    // Transition to STOPPING
    this.state = 'stopping';
    this.emitStateChange(previousState);

    // Simulate sensor stopping
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Simulate video saved
    this.context.videoPath = `/mock/sessions/${this.context.sessionId}/video.mp4`;
    this.context.videoDurationMs = this.context.startTime ? Date.now() - this.context.startTime : 0;

    const resultContext = { ...this.context };

    // Transition to IDLE
    const stoppingState = this.state;
    this.state = 'idle';
    this.emitStateChange(stoppingState);

    // Reset context after delay
    setTimeout(() => {
      this.context = {
        plannedDuration: 30,
        startedBy: 'unknown',
        videoReady: false,
        watchReady: false,
        arduinoReady: false,
      };
    }, 1000);

    return {
      success: true,
      state: this.state,
      result: resultContext,
    };
  }

  async acknowledgeError(): Promise<AcknowledgeErrorResult> {
    console.log('[RecordingStateMachineWeb] acknowledgeError');

    if (this.state !== 'error') {
      return {
        success: false,
        state: this.state,
      };
    }

    const previousState = this.state;
    this.context.errorMessage = undefined;
    this.state = 'idle';
    this.emitStateChange(previousState);

    return {
      success: true,
      state: this.state,
    };
  }

  async forceReset(): Promise<ForceResetResult> {
    console.log('[RecordingStateMachineWeb] forceReset');

    const previousState = this.state;

    this.context = {
      plannedDuration: 30,
      startedBy: 'unknown',
      videoReady: false,
      watchReady: false,
      arduinoReady: false,
    };

    this.state = 'idle';
    this.emitStateChange(previousState);

    return {
      success: true,
      state: this.state,
    };
  }
}
