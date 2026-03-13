/**
 * Type definitions for Multi-Session Analytics
 */

// Date range presets for filtering
export type DateRangePreset = '7D' | '30D' | '3M' | '1Y' | 'custom';

// Custom date range
export interface CustomDateRange {
  startDate: Date;
  endDate: Date;
}

// Session analytics summary for multi-session charts
export interface SessionAnalyticsSummary {
  sessionId: number;
  sessionDate: string; // ISO date string
  durationMinutes: number;

  // Grip force metrics
  preCalibrationMaxForce: number | null;
  postCalibrationMaxForce: number | null;
  avgGripForceAtImpact: number | null;
  gripForcePercent: number | null; // computed: avgGripForceAtImpact / preCalibrationMaxForce * 100

  // Impact metrics
  avgAccelerationAtImpact: number | null;
  avgVelocityAtImpact: number | null;

  // Efficiency per stroke type
  avgEfficiencyForehand: number | null;
  avgEfficiencyBackhand: number | null;
  avgEfficiencyServe: number | null;

  // Stroke counts
  strokeCountForehand: number;
  strokeCountBackhand: number;
  strokeCountServe: number;
}

// Chart data point for multi-session visualizations
export interface AnalyticsChartDataPoint {
  date: string; // ISO date string
  sessionId: number;
  value: number | null;
  label?: string; // Session name or description
}

// Multi-session chart data
export interface MultiSessionChartData {
  dataPoints: AnalyticsChartDataPoint[];
  metric: string;
  unit: string;
}

// Efficiency chart data by stroke type
export interface EfficiencyByStrokeData {
  date: string;
  sessionId: number;
  forehand: number | null;
  backhand: number | null;
  serve: number | null;
}

// Analytics state
export interface AnalyticsState {
  dateRangePreset: DateRangePreset;
  customDateRange: CustomDateRange | null;
  sessions: SessionAnalyticsSummary[];
  isLoading: boolean;
  error: string | null;
}

// Computed date range from preset
export function getDateRangeFromPreset(preset: DateRangePreset): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case '7D':
      start.setDate(start.getDate() - 7);
      break;
    case '30D':
      start.setDate(start.getDate() - 30);
      break;
    case '3M':
      start.setMonth(start.getMonth() - 3);
      break;
    case '1Y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'custom':
      // For custom, return last 30 days as default
      start.setDate(start.getDate() - 30);
      break;
  }

  return { start, end };
}

// Color scheme for analytics charts
export const ANALYTICS_COLORS = {
  primary: '#0A6C3B',
  accent: '#E0FF2D',
  forehand: '#e67e22',
  backhand: '#9b59b6',
  serve: '#27ae60',
  gridLine: '#e0e0e0',
  textPrimary: '#333333',
  textSecondary: '#666666',
};
