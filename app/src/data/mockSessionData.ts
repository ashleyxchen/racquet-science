/**
 * Mock session data for demo purposes.
 * This data is based on the CSV files in session-view-mock/mock-data/
 */

import type { StrokeStats } from '../types/charts';

export interface StrokeEvent {
  time: number; // seconds
  type: 'forehand' | 'backhand' | 'serve';
}

export interface EfficiencyDataPoint {
  strokeIndex: number;
  time: number;
  type: 'forehand' | 'backhand' | 'serve';
  efficiency: number;
}

export interface GripForceDataPoint {
  time: number; // seconds
  force: number; // Newtons
}

// Stroke events from stroke_data.csv
export const mockStrokes: StrokeEvent[] = [
  { time: 0.1, type: 'backhand' },
  { time: 1.452, type: 'forehand' },
  { time: 2.987, type: 'forehand' },
  { time: 4.646, type: 'forehand' },
  { time: 6.012, type: 'backhand' },
  { time: 7.550, type: 'forehand' },
  { time: 8.922, type: 'forehand' },
  { time: 10.542, type: 'serve' },
  { time: 12.097, type: 'serve' },
  { time: 13.399, type: 'serve' },
  { time: 15.247, type: 'backhand' },
  { time: 16.370, type: 'forehand' },
  { time: 18.012, type: 'forehand' },
  { time: 19.428, type: 'serve' },
  { time: 21.234, type: 'forehand' },
  { time: 22.417, type: 'backhand' },
  { time: 24.047, type: 'serve' },
  { time: 25.439, type: 'backhand' },
  { time: 27.136, type: 'serve' },
  { time: 28.608, type: 'backhand' },
];

// Kinematic efficiency data from kinematic_efficiency_data.csv
export const mockEfficiencyData: EfficiencyDataPoint[] = [
  { strokeIndex: 1, time: 0.1, type: 'backhand', efficiency: 99.95 },
  { strokeIndex: 2, time: 1.452, type: 'forehand', efficiency: 98.79 },
  { strokeIndex: 3, time: 2.987, type: 'forehand', efficiency: 97.46 },
  { strokeIndex: 4, time: 4.646, type: 'forehand', efficiency: 97.45 },
  { strokeIndex: 5, time: 6.012, type: 'backhand', efficiency: 96.32 },
  { strokeIndex: 6, time: 7.550, type: 'forehand', efficiency: 96.20 },
  { strokeIndex: 7, time: 8.922, type: 'forehand', efficiency: 94.79 },
  { strokeIndex: 8, time: 10.542, type: 'serve', efficiency: 94.35 },
  { strokeIndex: 9, time: 12.097, type: 'serve', efficiency: 93.28 },
  { strokeIndex: 10, time: 13.399, type: 'serve', efficiency: 92.17 },
  { strokeIndex: 11, time: 15.247, type: 'backhand', efficiency: 91.74 },
  { strokeIndex: 12, time: 16.370, type: 'forehand', efficiency: 90.04 },
  { strokeIndex: 13, time: 18.012, type: 'forehand', efficiency: 90.59 },
  { strokeIndex: 14, time: 19.428, type: 'serve', efficiency: 89.27 },
  { strokeIndex: 15, time: 21.234, type: 'forehand', efficiency: 88.33 },
  { strokeIndex: 16, time: 22.417, type: 'backhand', efficiency: 88.44 },
  { strokeIndex: 17, time: 24.047, type: 'serve', efficiency: 87.40 },
  { strokeIndex: 18, time: 25.439, type: 'backhand', efficiency: 86.44 },
  { strokeIndex: 19, time: 27.136, type: 'serve', efficiency: 86.14 },
  { strokeIndex: 20, time: 28.608, type: 'backhand', efficiency: 84.87 },
];

// Pain data from pain_data.csv
export const mockPainData = [
  { time: 4.0, level: 4 },
  { time: 6.0, level: 2 },
];

// Calibration data from calibration.csv
export const mockCalibration = {
  pre: { maxForce: 255.67, trials: [248.32, 241.18, 255.67] },
  post: { maxForce: 232.45, trials: [232.45, 228.91, 225.33] },
};

/**
 * Calculate stroke statistics from stroke events
 */
export function calculateStrokeStats(strokes: StrokeEvent[], efficiencyData: EfficiencyDataPoint[]): StrokeStats[] {
  const typeGroups = {
    forehand: strokes.filter(s => s.type === 'forehand'),
    backhand: strokes.filter(s => s.type === 'backhand'),
    serve: strokes.filter(s => s.type === 'serve'),
  };

  const total = strokes.length;

  return (['forehand', 'backhand', 'serve'] as const).map(type => {
    const count = typeGroups[type].length;
    const percentage = total > 0 ? (count / total) * 100 : 0;

    // Calculate average efficiency for this stroke type
    const typeEfficiencies = efficiencyData.filter(e => e.type === type);
    const avgEfficiency = typeEfficiencies.length > 0
      ? typeEfficiencies.reduce((sum, e) => sum + e.efficiency, 0) / typeEfficiencies.length
      : undefined;

    // Mock average grip force (would come from grip_force_data correlation)
    const avgGripForce = type === 'forehand' ? 85.2
      : type === 'backhand' ? 78.5
      : 95.8; // serve

    return {
      type,
      count,
      percentage,
      avgGripForce,
      avgEfficiency,
    };
  });
}

/**
 * Get mock grip force data for a time range
 * This simulates grip force during strokes
 */
export function getMockGripForceAtStrokes(strokes: StrokeEvent[]): { time: number; force: number; type: string }[] {
  return strokes.map(stroke => ({
    time: stroke.time,
    force: stroke.type === 'serve' ? 90 + Math.random() * 20
      : stroke.type === 'forehand' ? 75 + Math.random() * 20
      : 70 + Math.random() * 15, // backhand
    type: stroke.type,
  }));
}
