/**
 * VideoRecording Capacitor Plugin
 *
 * Native iOS video recording plugin for recording sessions
 */

import { registerPlugin } from '@capacitor/core';

export interface VideoRecordingPlugin {
  /**
   * Start camera preview (shows live camera feed behind transparent web view)
   * Call this before recording to let users position the camera
   */
  startPreview(): Promise<{ success: boolean }>;

  /**
   * Stop camera preview
   */
  stopPreview(): Promise<{ success: boolean }>;

  /**
   * Force stop preview regardless of state - used for cleanup during navigation
   * This method always succeeds and removes the native preview view
   */
  ensurePreviewStopped(): Promise<{ success: boolean }>;

  /**
   * Switch between front and back camera
   * @returns The new camera position ('front' or 'back')
   */
  switchCamera(): Promise<{ success: boolean; position: 'front' | 'back' }>;

  /**
   * Update the native overlay (duration, timer)
   */
  updateOverlay(options: {
    durationMinutes?: number;
    elapsedSeconds?: number;
    totalSeconds?: number;
  }): Promise<{ success: boolean }>;

  /**
   * Set recording mode (shows/hides appropriate overlays)
   */
  setRecordingMode(options: { isRecording: boolean }): Promise<{ success: boolean }>;

  /**
   * Set webview alpha (visibility) to prevent flash during camera transitions
   * @param options - alpha value (0 = hidden, 1 = visible)
   */
  setWebViewAlpha(options: { alpha: number }): Promise<{ success: boolean }>;

  /**
   * Start recording video for a session
   * @param options - Session ID to organize recordings
   */
  startRecording(options: { sessionId: string }): Promise<{ success: boolean; sessionId: string }>;

  /**
   * Stop the current video recording
   * @returns Path to the recorded video file and duration in milliseconds
   */
  stopRecording(): Promise<{ videoPath: string; durationMs: number }>;

  /**
   * Get the current recording status
   * @returns Recording status including isRecording flag and duration
   */
  getRecordingStatus(): Promise<{
    isRecording: boolean;
    durationMs: number;
    sessionId?: string;
  }>;

  /**
   * Check camera and microphone permissions
   */
  checkPermissions(): Promise<{
    camera: 'granted' | 'denied';
    microphone: 'granted' | 'denied';
  }>;

  /**
   * Request camera and microphone permissions
   */
  requestPermissions(): Promise<{
    camera: 'granted' | 'denied';
    microphone: 'granted' | 'denied';
  }>;

  /**
   * Add listener for recording started event
   */
  addListener(
    eventName: 'recordingStarted',
    listenerFunc: () => void
  ): Promise<any>;

  /**
   * Add listener for recording error event
   */
  addListener(
    eventName: 'recordingError',
    listenerFunc: (data: { error: string }) => void
  ): Promise<any>;

  /**
   * Add listener for recording stopped event
   */
  addListener(
    eventName: 'recordingStopped',
    listenerFunc: (data: { videoPath: string; durationMs: number }) => void
  ): Promise<any>;

  /**
   * Add listener for recording progress updates
   */
  addListener(
    eventName: 'recordingProgress',
    listenerFunc: (data: { durationMs: number }) => void
  ): Promise<any>;

  /**
   * Add listener for native start button tap
   */
  addListener(
    eventName: 'startButtonTapped',
    listenerFunc: (data: { timestamp: number; source: string }) => void
  ): Promise<any>;

  /**
   * Add listener for native stop button tap
   */
  addListener(
    eventName: 'stopButtonTapped',
    listenerFunc: (data: { timestamp: number }) => void
  ): Promise<any>;

  /**
   * Add listener for camera switch button tap
   */
  addListener(
    eventName: 'cameraSwitched',
    listenerFunc: (data: { position: 'front' | 'back' }) => void
  ): Promise<any>;

  /**
   * Add listener for close button tap (exit camera view)
   */
  addListener(
    eventName: 'closeButtonTapped',
    listenerFunc: (data: { timestamp: number; source: string }) => void
  ): Promise<any>;

  /**
   * Remove all listeners for this plugin
   */
  removeAllListeners(): Promise<void>;
}

const VideoRecording = registerPlugin<VideoRecordingPlugin>('VideoRecording');

export { VideoRecording };
export default VideoRecording;
