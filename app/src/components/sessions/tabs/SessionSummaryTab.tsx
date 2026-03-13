/**
 * SessionSummaryTab
 *
 * Displays aggregate statistics and charts for a session.
 * Uses Chart.js for real chart rendering.
 */

import { useState, useMemo } from 'react';
import {
  StrokeDistributionChart,
  EfficiencyTrendsChart,
  GripForceByTypeChart,
  GripForceTrendsChart,
} from '../charts';
import type { SessionResponse } from '../../../services/api/sessions';
import type { SensorDataForCharts } from '../../../types/sessionDetail';
import type { YAxisUnit } from '../../../types/charts';
import {
  mockStrokes,
  mockEfficiencyData,
  mockCalibration,
  calculateStrokeStats,
  getMockGripForceAtStrokes,
} from '../../../data/mockSessionData';

interface SessionSummaryTabProps {
  session: SessionResponse;
  sensorData: SensorDataForCharts | null;
}

interface SectionVisibility {
  strokeDist: boolean;
  gripByType: boolean;
  efficiencyTrends: boolean;
  gripTrends: boolean;
}

// Section toggle checkboxes
function SectionToggles({
  visibility,
  onChange,
}: {
  visibility: SectionVisibility;
  onChange: (key: keyof SectionVisibility) => void;
}) {
  return (
    <div className="section-toggles">
      <span className="toggle-label">Show:</span>
      <label>
        <input
          type="checkbox"
          checked={visibility.strokeDist}
          onChange={() => onChange('strokeDist')}
        />
        Stroke Distribution
      </label>
      <label>
        <input
          type="checkbox"
          checked={visibility.gripByType}
          onChange={() => onChange('gripByType')}
        />
        Grip Force by Type
      </label>
      <label>
        <input
          type="checkbox"
          checked={visibility.efficiencyTrends}
          onChange={() => onChange('efficiencyTrends')}
        />
        Efficiency Trends
      </label>
      <label>
        <input
          type="checkbox"
          checked={visibility.gripTrends}
          onChange={() => onChange('gripTrends')}
        />
        Grip Force Trends
      </label>
    </div>
  );
}

// Y-axis unit toggle
function YAxisToggle({
  value,
  onChange,
}: {
  value: YAxisUnit;
  onChange: (v: YAxisUnit) => void;
}) {
  return (
    <div className="y-axis-toggle">
      <label>
        Y-Axis Unit:
        <select value={value} onChange={(e) => onChange(e.target.value as YAxisUnit)}>
          <option value="N">Force (N)</option>
          <option value="percent">% max grip</option>
        </select>
      </label>
    </div>
  );
}

export function SessionSummaryTab({ session, sensorData }: SessionSummaryTabProps) {
  const [visibility, setVisibility] = useState<SectionVisibility>({
    strokeDist: true,
    gripByType: true,
    efficiencyTrends: true,
    gripTrends: true,
  });
  const [yAxisUnit, setYAxisUnit] = useState<YAxisUnit>('N');

  // Calculate stroke statistics from mock data
  const strokeStats = useMemo(
    () => calculateStrokeStats(mockStrokes, mockEfficiencyData),
    []
  );

  // Get grip force data at each stroke
  const gripForceData = useMemo(() => getMockGripForceAtStrokes(mockStrokes), []);

  // Get max grip force for percentage calculations
  const maxGripForce = session.calibration_max_force || mockCalibration.pre.maxForce;

  // Toggle visibility
  const toggleSection = (key: keyof SectionVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="session-summary-tab">
      <h2>Session Summary</h2>

      <SectionToggles visibility={visibility} onChange={toggleSection} />

      {/* Stroke Type Distribution */}
      {visibility.strokeDist && (
        <div className="summary-section">
          <h3>Stroke Type Distribution</h3>
          <StrokeDistributionChart stats={strokeStats} />
        </div>
      )}

      {/* Grip Force Analysis by Stroke Type */}
      {visibility.gripByType && (
        <div className="summary-section">
          <div className="section-header-row">
            <h3>Grip Force Analysis by Stroke Type</h3>
            <YAxisToggle value={yAxisUnit} onChange={setYAxisUnit} />
          </div>
          <GripForceByTypeChart
            stats={strokeStats}
            yAxisUnit={yAxisUnit}
            maxGripForce={maxGripForce}
            height={250}
          />
        </div>
      )}

      {/* Efficiency Trends by Stroke Type */}
      {visibility.efficiencyTrends && (
        <div className="summary-section">
          <h3>Efficiency Trends by Stroke Type</h3>
          <EfficiencyTrendsChart data={mockEfficiencyData} height={300} />
        </div>
      )}

      {/* Grip Force Trends by Stroke Type */}
      {visibility.gripTrends && (
        <div className="summary-section">
          <div className="section-header-row">
            <h3>Grip Force Trends by Stroke Type</h3>
            <YAxisToggle value={yAxisUnit} onChange={setYAxisUnit} />
          </div>
          <GripForceTrendsChart
            data={gripForceData}
            yAxisUnit={yAxisUnit}
            maxGripForce={maxGripForce}
            height={300}
          />
        </div>
      )}

      <div className="summary-footer">
        <p className="note">
          Data shown is from the demo session. Real-time stroke detection will be available in a future update.
        </p>
      </div>
    </div>
  );
}
