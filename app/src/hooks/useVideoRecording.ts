/**
 * React hook for video PREVIEW and camera controls only.
 *
 * NOTE: Video RECORDING is handled by useRecordingSession, not this hook.
 * This hook only manages:
 * - Camera preview (startPreview, stopPreview)
 * - Camera switching (switchCamera)
 * - Native overlay updates (updateOverlay, setRecordingMode)
 *
 * Usage:
 * ```tsx
 * const { startPreview, stopPreview, switchCamera, isPreviewing } = useVideoRecording();
 *
 * // Start camera preview
 * await startPreview();
 *
 * // Switch camera
 * await switchCamera();
 *
 * // Stop preview
 * await stopPreview();
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import VideoRecording from '../plugins/VideoRecording';

interface UseVideoRecordingResult {
  // Preview state
  isPreviewing: boolean;
  error: string | null;
  hasPermission: boolean;
  cameraPosition: 'front' | 'back';
  // Preview controls
  startPreview: () => Promise<void>;
  stopPreview: () => Promise<void>;
  forceStopPreview: () => Promise<void>;
  // Camera controls
  switchCamera: () => Promise<void>;
  // Native overlay controls
  updateOverlay: (options: { durationMinutes?: number; elapsedSeconds?: number; totalSeconds?: number }) => Promise<void>;
  setRecordingMode: (isRecording: boolean) => Promise<void>;
  // Permissions
  requestPermissions: () => Promise<boolean>;
  checkPermissions: () => Promise<boolean>;
}

export function useVideoRecording(): UseVideoRecordingResult {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');

  // Check if running on native platform
  const isNative = Capacitor.isNativePlatform();

  // Check permissions on mount
  useEffect(() => {
    if (isNative) {
      checkPermissions();
    }
  }, [isNative]);

  // NOTE: Recording event listeners are NOT set up here.
  // Video recording is managed by useRecordingSession hook.
  // This hook only handles preview and camera controls.

  const checkPermissions = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      setHasPermission(false);
      return false;
    }

    try {
      const result = await VideoRecording.checkPermissions();
      const granted = result.camera === 'granted' && result.microphone === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (err) {
      console.error('Error checking permissions:', err);
      setHasPermission(false);
      return false;
    }
  }, [isNative]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      setError('Video recording is only available on native iOS');
      return false;
    }

    try {
      const result = await VideoRecording.requestPermissions();
      const granted = result.camera === 'granted' && result.microphone === 'granted';
      setHasPermission(granted);
      if (!granted) {
        setError('Camera or microphone permission denied');
      }
      return granted;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Permission request failed';
      setError(errorMsg);
      return false;
    }
  }, [isNative]);

  const startPreview = useCallback(async (): Promise<void> => {
    console.log('[useVideoRecording] startPreview called, isNative:', isNative, 'isPreviewing:', isPreviewing);

    if (!isNative) {
      console.log('[useVideoRecording] Preview not available on web');
      return;
    }

    if (isPreviewing) {
      console.log('[useVideoRecording] Already previewing, skipping');
      return;
    }

    try {
      // Check permissions first
      console.log('[useVideoRecording] Checking permissions...');
      const permitted = await checkPermissions();
      console.log('[useVideoRecording] Permissions granted:', permitted);

      if (!permitted) {
        console.log('[useVideoRecording] Requesting permissions...');
        const requestResult = await requestPermissions();
        if (!requestResult) {
          throw new Error('Camera permission required for preview');
        }
      }

      console.log('[useVideoRecording] Calling VideoRecording.startPreview()...');
      const result = await VideoRecording.startPreview();
      console.log('[useVideoRecording] startPreview result:', result);

      setIsPreviewing(true);
      setError(null);
      console.log('[useVideoRecording] Camera preview started successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start preview';
      setError(errorMsg);
      console.error('[useVideoRecording] Start preview error:', err);
    }
  }, [isNative, isPreviewing, checkPermissions, requestPermissions]);

  const stopPreview = useCallback(async (): Promise<void> => {
    if (!isNative) {
      return;
    }

    if (!isPreviewing) {
      return;
    }

    try {
      await VideoRecording.stopPreview();
      setIsPreviewing(false);
      setError(null);
      console.log('Camera preview stopped');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stop preview';
      setError(errorMsg);
      console.error('Stop preview error:', err);
    }
  }, [isNative, isPreviewing]);

  // Force stop preview regardless of state - bypasses isPreviewing check
  const forceStopPreview = useCallback(async (): Promise<void> => {
    if (!isNative) {
      return;
    }

    try {
      console.log('[useVideoRecording] Force stopping preview...');
      await VideoRecording.ensurePreviewStopped();
      setIsPreviewing(false);
      setError(null);
      console.log('[useVideoRecording] Force stop preview completed');
    } catch (err) {
      console.error('[useVideoRecording] Force stop preview failed:', err);
      // Still update state even if native call fails
      setIsPreviewing(false);
    }
  }, [isNative]);

  const switchCamera = useCallback(async (): Promise<void> => {
    if (!isNative) {
      console.log('[useVideoRecording] Camera switching not available on web');
      return;
    }

    try {
      const result = await VideoRecording.switchCamera();
      setCameraPosition(result.position);
      setError(null);
      console.log('Camera switched to:', result.position);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to switch camera';
      setError(errorMsg);
      console.error('Switch camera error:', err);
    }
  }, [isNative]);

  const updateOverlay = useCallback(async (options: { durationMinutes?: number; elapsedSeconds?: number; totalSeconds?: number }): Promise<void> => {
    if (!isNative) return;

    try {
      await VideoRecording.updateOverlay(options);
    } catch (err) {
      console.error('Update overlay error:', err);
    }
  }, [isNative]);

  const setRecordingMode = useCallback(async (recording: boolean): Promise<void> => {
    if (!isNative) return;

    try {
      await VideoRecording.setRecordingMode({ isRecording: recording });
    } catch (err) {
      console.error('Set recording mode error:', err);
    }
  }, [isNative]);

  // NOTE: startRecording and stopRecording are NOT provided by this hook.
  // Video recording is managed by useRecordingSession which calls
  // VideoRecording.startRecording() and VideoRecording.stopRecording() directly.

  return {
    isPreviewing,
    error,
    hasPermission,
    cameraPosition,
    startPreview,
    stopPreview,
    forceStopPreview,
    switchCamera,
    updateOverlay,
    setRecordingMode,
    requestPermissions,
    checkPermissions,
  };
}
