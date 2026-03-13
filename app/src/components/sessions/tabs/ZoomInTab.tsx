import { useState, useMemo, useCallback } from 'react';
import { VideoPlayer } from '../video/VideoPlayer';
import { GripForceChart } from '../charts/GripForceChart';
import type { SessionResponse } from '../../../services/api/sessions';
import type { SensorDataForCharts, ZoomRange } from '../../../types/sessionDetail';
import type { ChartDataPoint, GripForceData } from '../../../types/charts';

interface ZoomInTabProps {
  session: SessionResponse;
  sensorData: SensorDataForCharts | null;
  videoUrl: string | null;
  gripForceData?: GripForceData[];
}

// Time range selector component
function TimeRangeSelector({
  range,
  onRangeChange,
  maxTime,
  onLoad
}: {
  range: ZoomRange;
  onRangeChange: (range: ZoomRange) => void;
  maxTime: number;
  onLoad: () => void;
}) {
  const [startInput, setStartInput] = useState(range.startTime.toString());
  const [durationInput, setDurationInput] = useState(range.duration.toString());

  const handleLoad = () => {
    const newStart = Math.max(0, parseFloat(startInput) || 0);
    const newDuration = Math.max(0.5, parseFloat(durationInput) || 5);

    // Ensure we don't exceed max time
    const adjustedStart = Math.min(newStart, maxTime - newDuration);

    onRangeChange({
      startTime: adjustedStart,
      duration: newDuration
    });
    onLoad();
  };

  return (
    <div className="time-range-selector">
      <label>
        Start (s):
        <input
          type="number"
          min="0"
          max={maxTime}
          step="0.5"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
        />
      </label>
      <label>
        Duration (s):
        <input
          type="number"
          min="0.5"
          step="0.5"
          value={durationInput}
          onChange={(e) => setDurationInput(e.target.value)}
        />
      </label>
      <button onClick={handleLoad}>Load</button>
      <div className="time-range-info">
        Window: {startInput}s - {(parseFloat(startInput) + parseFloat(durationInput)).toFixed(1)}s
      </div>
    </div>
  );
}

// Grip Force Heatmap component (4x10 grid)
function GripHeatmap({
  data,
  maxValue
}: {
  data: number[][]; // 4 rows x 10 cols
  maxValue: number;
}) {
  // Use a gradient from white (0) to red (max)
  const getColor = (value: number) => {
    const intensity = Math.min(value / maxValue, 1);
    const red = 255;
    const green = Math.round(255 * (1 - intensity));
    const blue = Math.round(255 * (1 - intensity));
    return `rgb(${red}, ${green}, ${blue})`;
  };

  return (
    <div className="heatmap-container">
      <h3>Grip Force Heatmap</h3>
      <div className="heatmap-grid">
        {data.map((row, rowIdx) => (
          <div key={rowIdx} className="heatmap-row">
            {row.map((value, colIdx) => (
              <div
                key={colIdx}
                className="heatmap-cell"
                style={{ backgroundColor: getColor(value) }}
                title={`Row ${rowIdx + 1}, Col ${colIdx + 1}: ${value.toFixed(1)} N`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-scale">
        <div className="scale-label">Force Distribution</div>
        <div className="scale-gradient-container">
          <span className="scale-min">0 N</span>
          <div className="scale-gradient" />
          <span className="scale-max">{maxValue.toFixed(0)} N</span>
        </div>
      </div>
    </div>
  );
}

// Kinematic Efficiency Chart (placeholder for now)
function KinematicEfficiencyChart({
  data,
  currentTime
}: {
  data: ChartDataPoint[];
  currentTime?: number;
}) {
  return (
    <div className="kinematic-chart-container">
      <h3>Kinematic Efficiency</h3>
      <div className="chart-placeholder">
        <p>Efficiency data: {data.length} points</p>
        <p>Current time: {currentTime?.toFixed(2)}s</p>
        {/* TODO: Implement actual efficiency chart when backend provides data */}
      </div>
    </div>
  );
}

export function ZoomInTab({ session, sensorData, videoUrl, gripForceData = [] }: ZoomInTabProps) {
  const [zoomRange, setZoomRange] = useState<ZoomRange>({ startTime: 0, duration: 5 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [loop, setLoop] = useState(false);
  const [videoTime, setVideoTime] = useState(0);

  // Calculate max time from session duration
  const maxTime = session.duration || 60;

  // Filter grip force data to zoom range
  const windowedGripData = useMemo(() => {
    if (!gripForceData || gripForceData.length === 0) {
      return [];
    }

    const startIdx = gripForceData.findIndex(d => d.timestamp >= zoomRange.startTime);
    const endIdx = gripForceData.findIndex(d => d.timestamp >= zoomRange.startTime + zoomRange.duration);

    if (startIdx === -1) return [];

    const filtered = endIdx === -1
      ? gripForceData.slice(startIdx)
      : gripForceData.slice(startIdx, endIdx);

    return filtered.map(d => ({
      x: d.timestamp,
      y: d.force
    }));
  }, [gripForceData, zoomRange]);

  // Generate average heatmap data for the zoom range
  const heatmapData = useMemo(() => {
    // If we have grip force data with grid info, aggregate it
    if (gripForceData && gripForceData.some(d => d.grid)) {
      const gridsInRange = gripForceData.filter(
        d => d.timestamp >= zoomRange.startTime &&
             d.timestamp < zoomRange.startTime + zoomRange.duration &&
             d.grid
      );

      if (gridsInRange.length > 0) {
        // Average all grids in the time range
        const avgGrid = Array.from({ length: 4 }, () => Array(10).fill(0));

        gridsInRange.forEach(d => {
          if (d.grid) {
            d.grid.forEach((row, i) => {
              row.forEach((val, j) => {
                avgGrid[i][j] += val;
              });
            });
          }
        });

        // Divide by count to get average
        avgGrid.forEach(row => {
          row.forEach((_, j) => {
            row[j] /= gridsInRange.length;
          });
        });

        return avgGrid;
      }
    }

    // Generate placeholder data based on current video time
    const seed = Math.floor(videoTime * 10);
    return Array.from({ length: 4 }, (_, rowIdx) =>
      Array.from({ length: 10 }, (_, colIdx) => {
        // Create a pattern that varies with time
        const base = (rowIdx + 1) * (colIdx + 1) * 2;
        const variance = Math.sin((seed + rowIdx + colIdx) * 0.5) * 20;
        return Math.max(0, base + variance);
      })
    );
  }, [gripForceData, zoomRange, videoTime]);

  // Calculate max value for heatmap scaling
  const maxHeatmapValue = useMemo(() => {
    return Math.max(...heatmapData.flat(), 1);
  }, [heatmapData]);

  // Generate placeholder kinematic efficiency data
  const kinematicData = useMemo(() => {
    // Generate sample efficiency data (50-100%)
    const points: ChartDataPoint[] = [];
    const step = 0.1;
    for (let t = zoomRange.startTime; t <= zoomRange.startTime + zoomRange.duration; t += step) {
      points.push({
        x: t,
        y: 60 + Math.sin(t * 2) * 20 + Math.random() * 10
      });
    }
    return points;
  }, [zoomRange]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleVideoTimeUpdate = useCallback((time: number) => {
    setVideoTime(time);
  }, []);

  const handleChartClick = useCallback((time: number) => {
    // Video player will handle the time seek via currentTime prop
    setVideoTime(time);
  }, []);

  return (
    <div className="zoom-in-tab">
      <h2>Zoom In - Detailed View</h2>

      <TimeRangeSelector
        range={zoomRange}
        onRangeChange={setZoomRange}
        maxTime={maxTime}
        onLoad={handleLoad}
      />

      {!isLoaded ? (
        <div className="zoom-placeholder">
          <p>Select a time range and click "Load" to view detailed data</p>
        </div>
      ) : (
        <div className="zoom-content">
          {/* Video Player */}
          {videoUrl && (
            <div className="zoom-video-section">
              <h3>Video ({zoomRange.startTime}s - {(zoomRange.startTime + zoomRange.duration).toFixed(1)}s)</h3>
              <div className="loop-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                  />
                  Loop playback
                </label>
              </div>
              <VideoPlayer
                videoUrl={videoUrl}
                startTime={zoomRange.startTime}
                endTime={zoomRange.startTime + zoomRange.duration}
                loop={loop}
                currentTime={videoTime}
                onTimeUpdate={handleVideoTimeUpdate}
                showSpeedControls={true}
              />
            </div>
          )}

          {/* Sum of Grip Force Chart */}
          {windowedGripData.length > 0 && (
            <div className="zoom-chart-section">
              <GripForceChart
                data={windowedGripData}
                yAxisUnit="N"
                currentTime={videoTime}
                onTimeClick={handleChartClick}
                height={250}
              />
            </div>
          )}

          {/* Grip Force Heatmap */}
          <div className="zoom-heatmap-section">
            <GripHeatmap data={heatmapData} maxValue={maxHeatmapValue} />
          </div>

          {/* Kinematic Efficiency Chart */}
          <div className="zoom-efficiency-section">
            <KinematicEfficiencyChart
              data={kinematicData}
              currentTime={videoTime}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ZoomInTab;
