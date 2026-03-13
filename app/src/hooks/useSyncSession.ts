/**
 * React hook for syncing recording sessions to the backend
 *
 * Provides state management and easy-to-use functions for syncing sessions.
 *
 * Usage:
 * ```tsx
 * const {
 *   isSyncing,
 *   progress,
 *   lastResult,
 *   syncSession,
 *   checkBackend
 * } = useSyncSession();
 *
 * // Sync a completed recording
 * const result = await syncSession(recordingResult, { metadata: { location: 'Court 1' } });
 * ```
 */

import { useState, useCallback } from 'react';
import {
  syncSession as doSync,
  isBackendAvailable,
  type SyncProgress,
  type SyncResult,
  type SyncOptions,
} from '../services/SyncService';
import type { RecordingSessionResult } from './useRecordingSession';

export interface UseSyncSessionReturn {
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Current sync progress */
  progress: SyncProgress | null;
  /** Result of the last sync attempt */
  lastResult: SyncResult | null;
  /** Whether the backend is available */
  isBackendAvailable: boolean | null;
  /** Error message if sync failed */
  error: string | null;
  /** Sync a session to the backend */
  syncSession: (session: RecordingSessionResult, options?: SyncOptions) => Promise<SyncResult>;
  /** Check if the backend is available */
  checkBackend: () => Promise<boolean>;
  /** Reset the sync state */
  reset: () => void;
}

export function useSyncSession(): UseSyncSessionReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkBackend = useCallback(async (): Promise<boolean> => {
    try {
      const available = await isBackendAvailable();
      setBackendAvailable(available);
      return available;
    } catch (err) {
      setBackendAvailable(false);
      return false;
    }
  }, []);

  const syncSession = useCallback(
    async (session: RecordingSessionResult, options?: SyncOptions): Promise<SyncResult> => {
      setIsSyncing(true);
      setError(null);
      setProgress(null);
      setLastResult(null);

      try {
        const result = await doSync(session, {
          ...options,
          onProgress: (p) => {
            setProgress(p);
            options?.onProgress?.(p);
          },
        });

        setLastResult(result);

        if (!result.success && result.error) {
          setError(result.error);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Sync failed';
        setError(errorMessage);
        const failedResult: SyncResult = {
          success: false,
          error: errorMessage,
        };
        setLastResult(failedResult);
        return failedResult;
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsSyncing(false);
    setProgress(null);
    setLastResult(null);
    setError(null);
  }, []);

  return {
    isSyncing,
    progress,
    lastResult,
    isBackendAvailable: backendAvailable,
    error,
    syncSession,
    checkBackend,
    reset,
  };
}

export type { SyncProgress, SyncResult, SyncOptions };
