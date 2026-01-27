import { useEffect, useState } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';

interface MotionData {
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  orientation: { roll: number; pitch: number; yaw: number };
}

interface FormattedMotionData {
  accel: { x: string; y: string; z: string };
  gyro: { x: string; y: string; z: string };
  orientation: { roll: string; pitch: string; yaw: string };
}

interface WatchMotionPlugin {
  isWatchConnected(): Promise<{ connected: boolean }>;
  getMotionData(): Promise<MotionData>;
  startListening(): Promise<{ status: string }>;
  addListener(
    eventName: 'motionData',
    callback: (data: MotionData) => void
  ): Promise<{ remove: () => void }>;
}

const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

export function formatMotionData(data: MotionData | null): FormattedMotionData {
  if (!data || !data.accel || !data.gyro || !data.orientation) {
    return {
      accel: { x: '0.000', y: '0.000', z: '0.000' },
      gyro: { x: '0.000', y: '0.000', z: '0.000' },
      orientation: { roll: '0.0', pitch: '0.0', yaw: '0.0' },
    };
  }

  return {
    accel: {
      x: data.accel.x.toFixed(3),
      y: data.accel.y.toFixed(3),
      z: data.accel.z.toFixed(3),
    },
    gyro: {
      x: data.gyro.x.toFixed(3),
      y: data.gyro.y.toFixed(3),
      z: data.gyro.z.toFixed(3),
    },
    orientation: {
      roll: ((data.orientation.roll * 180) / Math.PI).toFixed(1),
      pitch: ((data.orientation.pitch * 180) / Math.PI).toFixed(1),
      yaw: ((data.orientation.yaw * 180) / Math.PI).toFixed(1),
    },
  };
}

export function useWatchMotion() {
  const [watchData, setWatchData] = useState<FormattedMotionData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    console.log('useWatchMotion: useEffect running, isNative=' + isNative);

    // Skip on web platform
    if (!isNative) {
      console.log('WatchMotion: Skipping on web platform');
      return;
    }

    let cleanup: (() => void) | undefined;

    async function initialize() {
      console.log('useWatchMotion: initialize() called');

      // Try to check initial connection status, but don't fail if it errors
      try {
        console.log('useWatchMotion: calling isWatchConnected...');
        const result = await WatchMotion.isWatchConnected();
        console.log('useWatchMotion: isWatchConnected returned:', JSON.stringify(result));
        setIsConnected(result.connected);
      } catch (error) {
        console.warn('isWatchConnected check failed, will detect via data:', error);
      }

      // Set up listener for motion data - this is what really matters
      try {
        console.log('Setting up motionData listener...');
        const listener = await WatchMotion.addListener('motionData', (data) => {
          console.log('Watch motion data received in JS:', JSON.stringify(data));
          const formatted = formatMotionData(data);
          console.log('Formatted data:', JSON.stringify(formatted));
          setWatchData(formatted);
          setIsConnected(true); // If we get data, we're connected
        });

        cleanup = () => listener.remove();
        console.log('Watch motion listener registered successfully');

        // Signal to native that JS is ready - this also sends any cached data
        await WatchMotion.startListening();
        console.log('Started listening for motion data');
      } catch (error) {
        console.error('Failed to add motion listener:', error);
      }
    }

    initialize();

    return () => {
      cleanup?.();
    };
  }, [isNative]);

  return { watchData, isConnected };
}
