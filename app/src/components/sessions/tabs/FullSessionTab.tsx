import { useState, useMemo } from 'react';
import { VideoPlayer } from '../video/VideoPlayer';
import { GripForceChart } from '../charts/GripForceChart';
import { IMUChart } from '../charts/IMUChart';
import { KinematicEfficiencyChart } from '../charts/KinematicEfficiencyChart';
import type { SessionResponse } from '../../../services/api/sessions';
import type { SensorDataForCharts, CalibrationDisplayData } from '../../../types/sessionDetail';
import type { YAxisUnit, ChartDataPoint, StrokeEvent } from '../../../types/charts';
import {
  mockStrokes,
  mockEfficiencyData,
  mockCalibration,
  mockPainData,
} from '../../../data/mockSessionData';

interface FullSessionTabProps {
  session: SessionResponse;
  sensorData: SensorDataForCharts | null;
  videoUrl: string | null;
}

// Sliding window size in seconds
const CHART_WINDOW_SIZE = 10;

// Stroke type colors
const STROKE_COLORS: Record<string, string> = {
  forehand: '#e67e22',
  backhand: '#9b59b6',
  serve: '#27ae60',
};

// Pain level colors (1-10 scale)
const getPainColor = (level: number) => {
  if (level <= 3) return '#27ae60'; // Green - low
  if (level <= 6) return '#f39c12'; // Yellow/Orange - medium
  return '#e74c3c'; // Red - high
};

// CalibrationDisplay sub-component
function CalibrationDisplay({ calibration }: { calibration: CalibrationDisplayData }) {
  return (
    <div className="chart-section" style={{
      padding: '20px',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginTop: '24px'
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        Max Grip Strength (Calibration)
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{
          padding: '16px',
          background: '#f5f0ff',
          borderRadius: '8px',
          border: '2px solid #b8a5d9'
        }}>
          <h3 style={{ fontSize: '14px', color: '#7d5ba3', marginBottom: '8px', fontWeight: 600 }}>
            Pre-session
          </h3>
          {calibration.pre ? (
            <>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#9b7dd4', marginBottom: '4px' }}>
                {calibration.pre.maxForce.toFixed(1)} N
              </div>
              {calibration.pre.timestamp && (
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {new Date(calibration.pre.timestamp).toLocaleTimeString()}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic' }}>No data</div>
          )}
        </div>

        <div style={{
          padding: '16px',
          background: '#f5f0ff',
          borderRadius: '8px',
          border: '2px solid #b8a5d9'
        }}>
          <h3 style={{ fontSize: '14px', color: '#7d5ba3', marginBottom: '8px', fontWeight: 600 }}>
            Post-session
          </h3>
          {calibration.post ? (
            <>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#9b7dd4', marginBottom: '4px' }}>
                {calibration.post.maxForce.toFixed(1)} N
              </div>
              {calibration.post.timestamp && (
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {new Date(calibration.post.timestamp).toLocaleTimeString()}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic' }}>No data</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Y-axis unit toggle
function YAxisToggle({ value, onChange }: { value: YAxisUnit; onChange: (v: YAxisUnit) => void }) {
  return (
    <div className="y-axis-toggle" style={{ marginBottom: '12px' }}>
      <label htmlFor="y-axis-select" style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>
        Y-axis:
      </label>
      <select
        id="y-axis-select"
        value={value}
        onChange={(e) => onChange(e.target.value as YAxisUnit)}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid #ddd',
          fontSize: '14px',
          cursor: 'pointer'
        }}
      >
        <option value="N">Force (N)</option>
        <option value="percent">% max grip</option>
      </select>
    </div>
  );
}

// Pain Notes Section with actual data
function PainNotesSection({ painData, onTimeClick }: {
  painData: Array<{ time: number; level: number }>;
  onTimeClick?: (time: number) => void;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chart-section" style={{
      padding: '20px',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginTop: '24px'
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        Pain Notes
      </h2>
      {painData.length > 0 ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {painData.map((pain, index) => (
            <button
              key={index}
              onClick={() => onTimeClick?.(pain.time)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '20px',
                border: `2px solid ${getPainColor(pain.level)}`,
                background: `${getPainColor(pain.level)}15`,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'transform 0.1s',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: getPainColor(pain.level),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
              }}>
                {pain.level}
              </span>
              <span style={{ color: '#333' }}>@ {formatTime(pain.time)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '16px',
          background: '#f9f9f9',
          borderRadius: '8px',
          color: '#999',
          fontStyle: 'italic'
        }}>
          No pain notes recorded for this session
        </div>
      )}
    </div>
  );
}

// Strokes Section with actual data
function StrokesSection({ strokes, onTimeClick }: {
  strokes: StrokeEvent[];
  onTimeClick?: (time: number) => void;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Group strokes by type for summary
  const strokeCounts = useMemo(() => {
    return strokes.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [strokes]);

  return (
    <div className="chart-section" style={{
      padding: '20px',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginTop: '24px'
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        Strokes
      </h2>

      {/* Stroke summary */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(strokeCounts).map(([type, count]) => (
          <div key={type} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
          }}>
            <span style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: STROKE_COLORS[type] || '#999',
            }} />
            <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{type}:</span>
            <span style={{ color: '#666' }}>{count}</span>
          </div>
        ))}
        <div style={{ color: '#666', marginLeft: 'auto' }}>
          Total: <strong>{strokes.length}</strong>
        </div>
      </div>

      {/* Stroke chips */}
      {strokes.length > 0 ? (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '4px'
        }}>
          {strokes.map((stroke, index) => (
            <button
              key={index}
              onClick={() => onTimeClick?.(stroke.timestamp)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: `2px solid ${STROKE_COLORS[stroke.type]}`,
                background: `${STROKE_COLORS[stroke.type]}20`,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                color: STROKE_COLORS[stroke.type],
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = `0 2px 8px ${STROKE_COLORS[stroke.type]}40`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {stroke.type.charAt(0).toUpperCase()} @ {formatTime(stroke.timestamp)}
            </button>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '16px',
          background: '#f9f9f9',
          borderRadius: '8px',
          color: '#999',
          fontStyle: 'italic'
        }}>
          No strokes detected in this session
        </div>
      )}
    </div>
  );
}

export function FullSessionTab({ session, sensorData, videoUrl }: FullSessionTabProps) {
  const [videoTime, setVideoTime] = useState(0);
  const [yAxisUnit, setYAxisUnit] = useState<YAxisUnit>('N');

  // Handle chart clicks to seek video
  const handleChartClick = (time: number) => {
    setVideoTime(time);
  };

  // Get calibration data - use mock data for demo
  const calibration: CalibrationDisplayData = useMemo(() => ({
    pre: session.calibration_max_force
      ? {
          maxForce: session.calibration_max_force,
          timestamp: session.calibration_timestamp || ''
        }
      : {
          maxForce: mockCalibration.pre.maxForce,
          timestamp: ''
        },
    post: {
      maxForce: mockCalibration.post.maxForce,
      timestamp: ''
    }
  }), [session.calibration_max_force, session.calibration_timestamp]);

  // Convert mock strokes to StrokeEvent format
  const strokeEvents: StrokeEvent[] = useMemo(() =>
    mockStrokes.map(s => ({
      timestamp: s.time,
      type: s.type,
    })),
    []
  );

  // Generate grip force data from sensor data (using acceleration magnitude as proxy)
  const gripForceData: ChartDataPoint[] = useMemo(() => {
    if (!sensorData) return [];
    return sensorData.timestamps.map((t, i) => ({
      x: t,
      y: Math.sqrt(
        Math.pow(sensorData.accel.x[i], 2) +
        Math.pow(sensorData.accel.y[i], 2) +
        Math.pow(sensorData.accel.z[i], 2)
      ) * 15 // Scale factor to simulate grip force
    }));
  }, [sensorData]);

  // Max grip force for percentage calculations
  const maxGripForce = calibration.pre?.maxForce || 100;

  return (
    <div className="full-session-tab" style={{ padding: '16px' }}>
      {/* Video Player Section */}
      {videoUrl ? (
        <div style={{ marginBottom: '24px' }}>
          <VideoPlayer
            videoUrl={videoUrl}
            currentTime={videoTime}
            onTimeUpdate={setVideoTime}
            showSpeedControls={true}
          />
        </div>
      ) : (
        <div style={{
          padding: '40px',
          background: '#f9f9f9',
          borderRadius: '12px',
          textAlign: 'center',
          color: '#999',
          marginBottom: '24px'
        }}>
          No video available for this session
        </div>
      )}

      {/* Calibration Display */}
      <CalibrationDisplay calibration={calibration} />

      {/* Sum of Grip Force Chart */}
      <div className="chart-section" style={{
        padding: '20px',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginTop: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
          Sum of Grip Force
        </h2>
        <YAxisToggle value={yAxisUnit} onChange={setYAxisUnit} />
        {gripForceData.length > 0 ? (
          <GripForceChart
            data={gripForceData}
            yAxisUnit={yAxisUnit}
            maxGripForce={maxGripForce}
            currentTime={videoTime}
            strokeEvents={strokeEvents}
            onTimeClick={handleChartClick}
            height={300}
            windowSize={CHART_WINDOW_SIZE}
          />
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            No grip force data available
          </div>
        )}
      </div>

      {/* Kinematic Efficiency Chart */}
      <div className="chart-section" style={{
        padding: '20px',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginTop: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
          Kinematic Efficiency
        </h2>
        <KinematicEfficiencyChart
          data={mockEfficiencyData}
          currentTime={videoTime}
          onTimeClick={handleChartClick}
          height={300}
          windowSize={CHART_WINDOW_SIZE}
        />
      </div>

      {/* Racquet Motion IMU Chart (Accelerometer) */}
      {sensorData && (
        <div className="chart-section" style={{
          padding: '20px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginTop: '24px'
        }}>
          <IMUChart
            data={sensorData}
            type="accel"
            title="Racquet Motion (Accelerometer)"
            currentTime={videoTime}
            onTimeClick={handleChartClick}
            height={300}
            windowSize={CHART_WINDOW_SIZE}
          />
        </div>
      )}

      {/* Hand Motion IMU Chart (Gyroscope) */}
      {sensorData && (
        <div className="chart-section" style={{
          padding: '20px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginTop: '24px'
        }}>
          <IMUChart
            data={sensorData}
            type="gyro"
            title="Hand Motion (Gyroscope)"
            currentTime={videoTime}
            onTimeClick={handleChartClick}
            height={300}
            windowSize={CHART_WINDOW_SIZE}
          />
        </div>
      )}

      {/* Pain Notes Section */}
      <PainNotesSection
        painData={mockPainData}
        onTimeClick={handleChartClick}
      />

      {/* Strokes Section */}
      <StrokesSection
        strokes={strokeEvents}
        onTimeClick={handleChartClick}
      />
    </div>
  );
}

export default FullSessionTab;
