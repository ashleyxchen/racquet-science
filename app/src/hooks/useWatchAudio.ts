import { useEffect, useState, useCallback } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';

interface AudioData {
  dbLevel: number;
  timestamp: number;
  isReceiving: boolean;
}

interface AudioStatus {
  isPlaying: boolean;
  isReceiving: boolean;
  isMuted: boolean;
  dbLevel: number;
}

interface WatchMotionPlugin {
  // Audio methods
  setAudioMuted(options: { muted: boolean }): Promise<{ muted: boolean }>;
  getAudioStatus(): Promise<AudioStatus>;
  addListener(
    eventName: 'audioData',
    callback: (data: AudioData) => void
  ): Promise<{ remove: () => void }>;
}

const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

export interface WatchAudioState {
  isReceiving: boolean;
  dbLevel: number;
  isMuted: boolean;
}

export function useWatchAudio() {
  const [audioState, setAudioState] = useState<WatchAudioState>({
    isReceiving: false,
    dbLevel: -60,
    isMuted: false,
  });

  const isNative = Capacitor.isNativePlatform();

  const setMuted = useCallback(async (muted: boolean) => {
    if (!isNative) return;

    try {
      await WatchMotion.setAudioMuted({ muted });
      setAudioState((prev) => ({ ...prev, isMuted: muted }));
    } catch (error) {
      console.error('Failed to set audio muted:', error);
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) {
      console.log('useWatchAudio: Skipping on web platform');
      return;
    }

    let cleanup: (() => void) | undefined;

    async function initialize() {
      console.log('useWatchAudio: initializing...');

      // Get initial audio status
      try {
        const status = await WatchMotion.getAudioStatus();
        console.log('useWatchAudio: initial status:', status);
        setAudioState({
          isReceiving: status.isReceiving,
          dbLevel: status.dbLevel,
          isMuted: status.isMuted,
        });
      } catch (error) {
        console.warn('getAudioStatus check failed:', error);
      }

      // Set up listener for audio data events
      try {
        console.log('useWatchAudio: setting up audioData listener...');
        const listener = await WatchMotion.addListener('audioData', (data) => {
          setAudioState((prev) => ({
            ...prev,
            isReceiving: data.isReceiving,
            dbLevel: data.dbLevel,
          }));
        });

        cleanup = () => listener.remove();
        console.log('useWatchAudio: listener registered successfully');
      } catch (error) {
        console.error('Failed to add audio listener:', error);
      }
    }

    initialize();

    return () => {
      cleanup?.();
    };
  }, [isNative]);

  return { audioState, setMuted };
}
