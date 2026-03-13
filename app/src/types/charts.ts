// Chart.js related types

export interface ChartDataPoint {
  x: number; // time in seconds
  y: number;
}

export type YAxisUnit = 'N' | 'percent';

export interface StrokeEvent {
  id: string;
  timestamp: number; // seconds from session start
  type: 'forehand' | 'backhand' | 'serve';
  duration?: number; // ms
  gripForce?: number;
  efficiency?: number;
}

export interface PainNote {
  id: string;
  timestamp: number; // seconds from session start
  level: number; // 1-10
  notes?: string;
}

export interface GripForceData {
  timestamp: number;
  force: number; // in Newtons
  grid?: number[][]; // 4x10 for heatmap
}

export interface ChartAnnotation {
  type: 'line' | 'box';
  xValue: number;
  borderColor: string;
  label?: string;
}

export interface StrokeStats {
  type: 'forehand' | 'backhand' | 'serve';
  count: number;
  percentage: number;
  avgGripForce?: number;
  avgEfficiency?: number;
}
