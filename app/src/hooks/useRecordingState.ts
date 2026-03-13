/**
 * useRecordingState - React hook for the Recording State Machine
 *
 * This hook provides a clean interface to the native RecordingStateMachine.
 * The native iOS layer is the SINGLE SOURCE OF TRUTH for recording state.
 *
 * Features:
 * - Subscribes to native state change events
 * - Provides derived state (isRecording, canStart, canStop, isTransitioning)
 * - Exposes requestStart() and requestStop() functions
 * - Handles cleanup on unmount
 *
 * Usage:
 * ```tsx
 * const {
 *   state,
 *   context,
 *   isRecording,
 *   canStart,
 *   canStop,
 *   isTransitioning,
 *   requestStart,
 *   requestStop,
 *   acknowledgeError,
 *   forceReset,
 * } = useRecordingState();
 *
 * // Start recording
 * await requestStart({ sessionId: 'abc123', plannedDuration: 30 });
 *
 * // Stop recording
 * const result = await requestStop();
 * console.log('Video path:', result.result?.videoPath);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import RecordingStateMachine, {
  RecordingStateValue,
  RecordingContext,
  StateChangedEvent,
  RequestStartOptions,
  RequestStartResult,
  RequestStopResult,
} from '../plugins/RecordingStateMachine';

export interface UseRecordingStateResult {
  // Current state
  state: RecordingStateValue;
  context: RecordingContext;

  // Derived state
  isRecording: boolean;
  isIdle: boolean;
  isStarting: boolean;
  isStopping: boolean;
  isError: boolean;
  isTransitioning: boolean;
  canStart: boolean;
  canStop: boolean;

  // Elapsed time (updated every second while recording)
  elapsedMs: number;

  // Actions
  requestStart: (options: RequestStartOptions) => Promise<RequestStartResult>;
  requestStop: () => Promise<RequestStopResult>;
  acknowledgeError: () => Promise<void>;
  forceReset: () => Promise<void>;

  // Loading state for UI feedback
  isLoading: boolean;
}

const initialContext: RecordingContext = {
  plannedDuration: 30,
  startedBy: 'unknown',
  videoReady: false,
  watchReady: false,
  arduinoReady: false,
};

export function useRecordingState(): UseRecordingStateResult {
  // State from native
  const [state, setState] = useState<RecordingStateValue>('idle');
  const [context, setContext] = useState<RecordingContext>(initialContext);

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Refs for cleanup
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timer | null>(null);

  // Fetch initial state on mount
  useEffect(() => {
    const fetchState = async () => {
      try {
        const stateInfo = await RecordingStateMachine.getState();
        setState(stateInfo.state);
        setContext(stateInfo.context);
        console.log('[useRecordingState] Initial state:', stateInfo.state);
      } catch (err) {
        console.error('[useRecordingState] Failed to fetch initial state:', err);
      }
    };

    fetchState();
  }, []);

  // Subscribe to state change events
  useEffect(() => {
    const setupListener = async () => {
      try {
        const handle = await RecordingStateMachine.addListener('stateChanged', (event: StateChangedEvent) => {
          console.log(`[useRecordingState] State changed: ${event.previousState} → ${event.state}`);
          setState(event.state);
          setContext(event.context);

          // Reset elapsed time when recording starts
          if (event.state === 'recording' && event.previousState !== 'recording') {
            setElapsedMs(0);
          }
        });

        listenerRef.current = handle;
        console.log('[useRecordingState] State change listener registered');
      } catch (err) {
        console.error('[useRecordingState] Failed to setup listener:', err);
      }
    };

    setupListener();

    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
        console.log('[useRecordingState] State change listener removed');
      }
    };
  }, []);

  // Update elapsed time while recording
  useEffect(() => {
    if (state === 'recording' && context.startTime) {
      // Start timer
      elapsedTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - context.startTime!;
        setElapsedMs(elapsed);
      }, 100); // Update every 100ms for smooth display

      return () => {
        if (elapsedTimerRef.current) {
          clearInterval(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
        }
      };
    } else {
      // Clear timer when not recording
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
  }, [state, context.startTime]);

  // Derived state
  const isRecording = state === 'recording';
  const isIdle = state === 'idle';
  const isStarting = state === 'starting';
  const isStopping = state === 'stopping';
  const isError = state === 'error';
  const isTransitioning = state === 'starting' || state === 'stopping';
  const canStart = state === 'idle';
  const canStop = state === 'recording';

  // Actions
  const requestStart = useCallback(async (options: RequestStartOptions): Promise<RequestStartResult> => {
    console.log('[useRecordingState] requestStart:', options);
    setIsLoading(true);

    try {
      const result = await RecordingStateMachine.requestStart(options);
      console.log('[useRecordingState] requestStart result:', result);
      return result;
    } catch (err) {
      console.error('[useRecordingState] requestStart error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestStop = useCallback(async (): Promise<RequestStopResult> => {
    console.log('[useRecordingState] requestStop');
    setIsLoading(true);

    try {
      const result = await RecordingStateMachine.requestStop();
      console.log('[useRecordingState] requestStop result:', result);
      return result;
    } catch (err) {
      console.error('[useRecordingState] requestStop error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acknowledgeError = useCallback(async (): Promise<void> => {
    console.log('[useRecordingState] acknowledgeError');
    await RecordingStateMachine.acknowledgeError();
  }, []);

  const forceReset = useCallback(async (): Promise<void> => {
    console.log('[useRecordingState] forceReset');
    await RecordingStateMachine.forceReset();
  }, []);

  return {
    // Current state
    state,
    context,

    // Derived state
    isRecording,
    isIdle,
    isStarting,
    isStopping,
    isError,
    isTransitioning,
    canStart,
    canStop,

    // Elapsed time
    elapsedMs,

    // Actions
    requestStart,
    requestStop,
    acknowledgeError,
    forceReset,

    // Loading state
    isLoading,
  };
}

export default useRecordingState;
