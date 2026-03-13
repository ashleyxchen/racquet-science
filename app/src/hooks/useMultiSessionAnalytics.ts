/**
 * Hook for multi-session analytics data
 * Fetches sessions and transforms them into analytics-ready format
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { listSessions } from '../services/api/sessions';
import {
  DateRangePreset,
  CustomDateRange,
  SessionAnalyticsSummary,
  AnalyticsChartDataPoint,
  EfficiencyByStrokeData,
  getDateRangeFromPreset,
} from '../types/analytics';

export interface UseMultiSessionAnalyticsResult {
  // State
  sessions: SessionAnalyticsSummary[];
  isLoading: boolean;
  error: string | null;

  // Date range controls
  dateRangePreset: DateRangePreset;
  customDateRange: CustomDateRange | null;
  setDateRangePreset: (preset: DateRangePreset) => void;
  setCustomDateRange: (range: CustomDateRange) => void;

  // Computed chart data
  gripForcePercentData: AnalyticsChartDataPoint[];
  accelerationData: AnalyticsChartDataPoint[];
  velocityData: AnalyticsChartDataPoint[];
  efficiencyData: EfficiencyByStrokeData[];
  preCalibrationData: AnalyticsChartDataPoint[];
  postCalibrationData: AnalyticsChartDataPoint[];

  // Actions
  refresh: () => Promise<void>;
}

export function useMultiSessionAnalytics(): UseMultiSessionAnalyticsResult {
  const [sessions, setSessions] = useState<SessionAnalyticsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30D');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | null>(null);

  // Fetch sessions from API and transform to analytics format
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get date range based on preset or custom
      const dateRange = customDateRange && dateRangePreset === 'custom'
        ? { start: customDateRange.startDate, end: customDateRange.endDate }
        : getDateRangeFromPreset(dateRangePreset);

      // Fetch all sessions (backend doesn't support date filtering yet, so we filter client-side)
      const response = await listSessions({ limit: 1000, skip: 0 });

      // Transform and filter sessions
      const analyticsSessions: SessionAnalyticsSummary[] = response.sessions
        .filter((session: any) => {
          if (!session.started_at) return false;
          const sessionDate = new Date(session.started_at);
          return sessionDate >= dateRange.start && sessionDate <= dateRange.end;
        })
        .map((session: any) => {
          const preCalForce = session.calibration_max_force;
          const avgForceAtImpact = session.avg_grip_force_at_impact;

          // Compute grip force percentage
          const gripForcePercent = (preCalForce && avgForceAtImpact)
            ? (avgForceAtImpact / preCalForce) * 100
            : null;

          return {
            sessionId: session.id,
            sessionDate: session.started_at,
            durationMinutes: session.duration ? Math.round(session.duration / 60) : 0,
            preCalibrationMaxForce: session.calibration_max_force || null,
            postCalibrationMaxForce: session.post_calibration_max_force || null,
            avgGripForceAtImpact: session.avg_grip_force_at_impact || null,
            gripForcePercent,
            avgAccelerationAtImpact: session.avg_acceleration_at_impact || null,
            avgVelocityAtImpact: session.avg_velocity_at_impact || null,
            avgEfficiencyForehand: session.avg_efficiency_forehand || null,
            avgEfficiencyBackhand: session.avg_efficiency_backhand || null,
            avgEfficiencyServe: session.avg_efficiency_serve || null,
            strokeCountForehand: session.stroke_count_forehand || 0,
            strokeCountBackhand: session.stroke_count_backhand || 0,
            strokeCountServe: session.stroke_count_serve || 0,
          };
        })
        .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());

      setSessions(analyticsSessions);
    } catch (err) {
      console.error('Failed to fetch sessions for analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRangePreset, customDateRange]);

  // Fetch on mount and when date range changes
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Computed chart data
  const gripForcePercentData = useMemo((): AnalyticsChartDataPoint[] => {
    return sessions
      .filter(s => s.gripForcePercent !== null)
      .map(s => ({
        date: s.sessionDate,
        sessionId: s.sessionId,
        value: s.gripForcePercent,
      }));
  }, [sessions]);

  const accelerationData = useMemo((): AnalyticsChartDataPoint[] => {
    return sessions
      .filter(s => s.avgAccelerationAtImpact !== null)
      .map(s => ({
        date: s.sessionDate,
        sessionId: s.sessionId,
        value: s.avgAccelerationAtImpact,
      }));
  }, [sessions]);

  const velocityData = useMemo((): AnalyticsChartDataPoint[] => {
    return sessions
      .filter(s => s.avgVelocityAtImpact !== null)
      .map(s => ({
        date: s.sessionDate,
        sessionId: s.sessionId,
        value: s.avgVelocityAtImpact,
      }));
  }, [sessions]);

  const efficiencyData = useMemo((): EfficiencyByStrokeData[] => {
    return sessions
      .filter(s =>
        s.avgEfficiencyForehand !== null ||
        s.avgEfficiencyBackhand !== null ||
        s.avgEfficiencyServe !== null
      )
      .map(s => ({
        date: s.sessionDate,
        sessionId: s.sessionId,
        forehand: s.avgEfficiencyForehand,
        backhand: s.avgEfficiencyBackhand,
        serve: s.avgEfficiencyServe,
      }));
  }, [sessions]);

  const preCalibrationData = useMemo((): AnalyticsChartDataPoint[] => {
    return sessions
      .filter(s => s.preCalibrationMaxForce !== null)
      .map(s => ({
        date: s.sessionDate,
        sessionId: s.sessionId,
        value: s.preCalibrationMaxForce,
      }));
  }, [sessions]);

  const postCalibrationData = useMemo((): AnalyticsChartDataPoint[] => {
    return sessions
      .filter(s => s.postCalibrationMaxForce !== null)
      .map(s => ({
        date: s.sessionDate,
        sessionId: s.sessionId,
        value: s.postCalibrationMaxForce,
      }));
  }, [sessions]);

  return {
    sessions,
    isLoading,
    error,
    dateRangePreset,
    customDateRange,
    setDateRangePreset,
    setCustomDateRange,
    gripForcePercentData,
    accelerationData,
    velocityData,
    efficiencyData,
    preCalibrationData,
    postCalibrationData,
    refresh: fetchSessions,
  };
}
