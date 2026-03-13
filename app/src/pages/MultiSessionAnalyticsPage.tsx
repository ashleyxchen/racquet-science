/**
 * MultiSessionAnalyticsPage - Performance trends across multiple sessions
 */

import { useNavigate } from 'react-router-dom';
import { useMultiSessionAnalytics } from '../hooks/useMultiSessionAnalytics';
import {
  TimeRangeSelector,
  MultiSessionGripForceChart,
  MultiSessionAccelerationChart,
  MultiSessionVelocityChart,
  MultiSessionEfficiencyChart,
  CalibrationTrendChart,
} from '../components/analytics';

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M23 4V10H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function MultiSessionAnalyticsPage() {
  const navigate = useNavigate();
  const {
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
    refresh,
  } = useMultiSessionAnalytics();

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="analytics-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <h1 className="analytics-title">Performance Analytics</h1>
        <button className="refresh-button" onClick={refresh} disabled={isLoading}>
          <RefreshIcon />
        </button>
      </div>

      {/* Time Range Selector */}
      <TimeRangeSelector
        selectedPreset={dateRangePreset}
        customRange={customDateRange}
        onPresetChange={setDateRangePreset}
        onCustomRangeChange={setCustomDateRange}
      />

      {/* Summary Stats */}
      <div className="analytics-summary">
        <div className="summary-stat">
          <span className="stat-value">{sessions.length}</span>
          <span className="stat-label">Sessions</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">
            {sessions.reduce((acc, s) => acc + s.strokeCountForehand + s.strokeCountBackhand + s.strokeCountServe, 0)}
          </span>
          <span className="stat-label">Total Strokes</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">
            {sessions.reduce((acc, s) => acc + s.durationMinutes, 0)}
          </span>
          <span className="stat-label">Total Mins</span>
        </div>
      </div>

      {/* Loading / Error States */}
      {isLoading && (
        <div className="analytics-loading">
          <div className="loading-spinner" />
          <p>Loading analytics...</p>
        </div>
      )}

      {error && (
        <div className="analytics-error">
          <p>{error}</p>
          <button onClick={refresh}>Try Again</button>
        </div>
      )}

      {/* Charts */}
      {!isLoading && !error && (
        <div className="analytics-charts">
          {/* Grip Force % Chart */}
          <div className="chart-card">
            <MultiSessionGripForceChart
              data={gripForcePercentData}
              title="Grip Force % (at Impact)"
            />
            <p className="chart-description">
              Average grip force at ball impact relative to your max calibrated force
            </p>
          </div>

          {/* Acceleration Chart */}
          <div className="chart-card">
            <MultiSessionAccelerationChart
              data={accelerationData}
              title="Avg Acceleration at Impact"
            />
            <p className="chart-description">
              Average acceleration of your racket at the moment of ball impact
            </p>
          </div>

          {/* Velocity Chart */}
          <div className="chart-card">
            <MultiSessionVelocityChart
              data={velocityData}
              title="Avg Velocity at Impact"
            />
            <p className="chart-description">
              Average velocity of your racket at the moment of ball impact
            </p>
          </div>

          {/* Efficiency by Stroke Type */}
          <div className="chart-card">
            <MultiSessionEfficiencyChart
              data={efficiencyData}
              title="Kinematic Efficiency"
            />
            <p className="chart-description">
              Efficiency of energy transfer from body to racket by stroke type
            </p>
          </div>

          {/* Calibration Trends */}
          <div className="chart-card">
            <CalibrationTrendChart
              preCalData={preCalibrationData}
              postCalData={postCalibrationData}
              title="Calibration Force Trends"
            />
            <p className="chart-description">
              Pre and post-session max grip force to track fatigue patterns
            </p>
          </div>

          {/* Empty State */}
          {sessions.length === 0 && (
            <div className="analytics-empty">
              <p>No sessions found for this time range</p>
              <button onClick={() => navigate('/record-wizard')}>
                Record Your First Session
              </button>
            </div>
          )}

          {/* Click hint */}
          {sessions.length > 0 && (
            <p className="chart-hint">
              Tap any data point to view that session's details
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiSessionAnalyticsPage;
