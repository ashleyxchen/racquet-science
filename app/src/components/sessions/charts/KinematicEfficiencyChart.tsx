/**
 * KinematicEfficiencyChart
 *
 * Line chart showing kinematic efficiency over time with stroke type colors.
 * Displays efficiency values at each stroke event.
 */

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

export interface EfficiencyDataPoint {
  strokeIndex: number;
  time: number;
  type: 'forehand' | 'backhand' | 'serve';
  efficiency: number;
}

interface KinematicEfficiencyChartProps {
  data: EfficiencyDataPoint[];
  currentTime?: number;
  onTimeClick?: (time: number) => void;
  height?: number;
  windowSize?: number; // Sliding window size in seconds
}

const STROKE_COLORS = {
  forehand: {
    border: '#e67e22',
    background: 'rgba(230, 126, 34, 0.8)',
  },
  backhand: {
    border: '#9b59b6',
    background: 'rgba(155, 89, 182, 0.8)',
  },
  serve: {
    border: '#27ae60',
    background: 'rgba(39, 174, 96, 0.8)',
  },
};

export function KinematicEfficiencyChart({
  data,
  currentTime,
  onTimeClick,
  height = 300,
  windowSize,
}: KinematicEfficiencyChartProps) {
  // Filter data for sliding window if windowSize is provided
  const filteredData = useMemo(() => {
    if (!windowSize || currentTime === undefined) return data;

    const windowStart = Math.max(0, currentTime - windowSize / 2);
    const windowEnd = currentTime + windowSize / 2;

    return data.filter(d => d.time >= windowStart && d.time <= windowEnd);
  }, [data, currentTime, windowSize]);

  // Calculate x-axis range for sliding window
  const xAxisRange = useMemo(() => {
    if (!windowSize || currentTime === undefined) {
      return { min: undefined, max: undefined };
    }
    return {
      min: Math.max(0, currentTime - windowSize / 2),
      max: currentTime + windowSize / 2,
    };
  }, [currentTime, windowSize]);

  const chartData = useMemo(() => {
    // Create a single dataset with point colors based on stroke type
    const pointBackgroundColors = filteredData.map(d => STROKE_COLORS[d.type].background);
    const pointBorderColors = filteredData.map(d => STROKE_COLORS[d.type].border);

    return {
      datasets: [
        {
          label: 'Efficiency',
          data: filteredData.map(d => ({ x: d.time, y: d.efficiency })),
          borderColor: 'rgba(52, 152, 219, 0.6)',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 2,
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: pointBackgroundColors,
          pointBorderColor: pointBorderColors,
          pointBorderWidth: 2,
          tension: 0.3,
          fill: false,
        },
      ],
    };
  }, [filteredData]);

  // Create annotation for current time
  const annotations = useMemo(() => {
    const result: Record<string, unknown> = {};

    if (currentTime !== undefined) {
      result.currentTime = {
        type: 'line',
        xMin: currentTime,
        xMax: currentTime,
        borderColor: 'rgba(255, 0, 0, 0.8)',
        borderWidth: 3,
        label: {
          display: false,
        },
      };
    }

    return result;
  }, [currentTime]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            generateLabels: () => [
              { text: 'Forehand', fillStyle: STROKE_COLORS.forehand.background, strokeStyle: STROKE_COLORS.forehand.border, lineWidth: 2 },
              { text: 'Backhand', fillStyle: STROKE_COLORS.backhand.background, strokeStyle: STROKE_COLORS.backhand.border, lineWidth: 2 },
              { text: 'Serve', fillStyle: STROKE_COLORS.serve.background, strokeStyle: STROKE_COLORS.serve.border, lineWidth: 2 },
            ],
          },
        },
        title: {
          display: true,
          text: 'Kinematic Efficiency (%)',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const dataIndex = context.dataIndex;
              const point = filteredData[dataIndex];
              if (point) {
                return [
                  `Efficiency: ${point.efficiency.toFixed(1)}%`,
                  `Stroke: ${point.type}`,
                  `Time: ${point.time.toFixed(2)}s`,
                ];
              }
              return `${context.parsed.y.toFixed(1)}%`;
            },
          },
        },
        annotation: {
          annotations,
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Time (seconds)',
          },
          min: xAxisRange.min,
          max: xAxisRange.max,
          ticks: {
            callback: (value) => {
              const seconds = Number(value);
              const minutes = Math.floor(seconds / 60);
              const secs = Math.floor(seconds % 60);
              return `${minutes}:${secs.toString().padStart(2, '0')}`;
            },
          },
        },
        y: {
          min: 80,
          max: 100,
          title: {
            display: true,
            text: 'Efficiency (%)',
          },
        },
      },
      onClick: (event, elements, chart) => {
        if (!onTimeClick) return;

        const canvasPosition = ChartJS.helpers.getRelativePosition(event, chart);
        const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);

        if (dataX !== undefined) {
          onTimeClick(dataX);
        }
      },
    }),
    [filteredData, annotations, xAxisRange, onTimeClick]
  );

  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95a5a6' }}>
        No efficiency data available
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
