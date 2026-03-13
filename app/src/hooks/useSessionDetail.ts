/**
 * useSessionDetail Hook
 *
 * Fetches session data, sensor data, FSR data, and video URL for a session detail view.
 */

import { useState, useEffect } from 'react';
import { getSession } from '../services/api/sessions';
import { getSensorData } from '../services/api/sensorData';
import { getFSRData } from '../services/api/fsrData';
import { getVideoStreamUrl } from '../services/api/videos';
import type { SessionResponse } from '../services/api/sessions';
import type { SensorDataForCharts, FSRDataForCharts } from '../types/sessionDetail';
import type { SensorSampleResponse } from '../services/api/sensorData';
import type { FSRSampleResponse } from '../services/api/fsrData';

export interface UseSessionDetailResult {
  session: SessionResponse | null;
  sensorData: SensorDataForCharts | null;
  fsrData: FSRDataForCharts | null;
  videoUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Transform API sensor data into chart-friendly format
 */
function transformSensorData(samples: SensorSampleResponse[] | null | undefined): SensorDataForCharts | null {
  if (!samples || samples.length === 0) {
    return null;
  }

  const accelX: number[] = [];
  const accelY: number[] = [];
  const accelZ: number[] = [];
  const gyroX: number[] = [];
  const gyroY: number[] = [];
  const gyroZ: number[] = [];
  const timestamps: number[] = [];

  // Assume all samples are from the same source (first sample)
  const source = samples[0].source as 'watch' | 'arduino';

  for (const sample of samples) {
    // Convert relative time from ms to seconds
    timestamps.push(sample.relative_time_ms / 1000);

    // Add sensor values (use 0 as fallback)
    accelX.push(sample.accel_x ?? 0);
    accelY.push(sample.accel_y ?? 0);
    accelZ.push(sample.accel_z ?? 0);
    gyroX.push(sample.gyro_x ?? 0);
    gyroY.push(sample.gyro_y ?? 0);
    gyroZ.push(sample.gyro_z ?? 0);
  }

  return {
    accel: {
      x: accelX,
      y: accelY,
      z: accelZ,
    },
    gyro: {
      x: gyroX,
      y: gyroY,
      z: gyroZ,
    },
    timestamps,
    source,
  };
}

/**
 * Transform API FSR data into chart-friendly format
 */
function transformFSRData(samples: FSRSampleResponse[] | null | undefined): FSRDataForCharts | null {
  if (!samples || samples.length === 0) {
    return null;
  }

  const timestamps: number[] = [];
  const frames: number[][] = [];

  for (const sample of samples) {
    // Convert relative time from ms to seconds
    timestamps.push(sample.relative_time_ms / 1000);
    frames.push(sample.values);
  }

  return {
    timestamps,
    frames,
    frameCount: samples.length,
    gridSize: { rows: 4, cols: 8 },
  };
}

/**
 * Hook for fetching and managing session detail data
 */
export function useSessionDetail(sessionId: number): UseSessionDetailResult {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sensorData, setSensorData] = useState<SensorDataForCharts | null>(null);
  const [fsrData, setFSRData] = useState<FSRDataForCharts | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSessionDetail() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch session metadata
        console.log(`[useSessionDetail] Fetching session ${sessionId}`);
        const sessionData = await getSession(sessionId);

        if (!isMounted) return;
        setSession(sessionData);

        // Fetch sensor data if available
        if (sessionData.has_watch_data || sessionData.has_arduino_data) {
          console.log(`[useSessionDetail] Fetching sensor data for session ${sessionId}`);
          // Request all sensor data (use high limit to get full session)
          // Backend returns array directly, not { samples: [...] }
          const samples = await getSensorData(sessionId, { limit: 50000 });

          if (!isMounted) return;

          const transformedData = transformSensorData(samples);
          setSensorData(transformedData);
        }

        // Fetch FSR data if available
        if (sessionData.has_fsr_data) {
          console.log(`[useSessionDetail] Fetching FSR data for session ${sessionId}`);
          const fsrSamples = await getFSRData(sessionId, { limit: 50000 });

          if (!isMounted) return;

          const transformedFSRData = transformFSRData(fsrSamples);
          setFSRData(transformedFSRData);
        }

        // Set video URL if available
        if (sessionData.has_video) {
          const url = getVideoStreamUrl(sessionId);
          if (!isMounted) return;
          setVideoUrl(url);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('[useSessionDetail] Error fetching session detail:', err);
        if (!isMounted) return;

        setError(err instanceof Error ? err.message : 'Failed to fetch session detail');
        setIsLoading(false);
      }
    }

    if (sessionId > 0) {
      fetchSessionDetail();
    } else {
      setError('Invalid session ID');
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  return {
    session,
    sensorData,
    fsrData,
    videoUrl,
    isLoading,
    error,
  };
}
