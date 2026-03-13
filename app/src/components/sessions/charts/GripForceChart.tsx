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
  Filler,
  ChartOptions,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import type { ChartDataPoint, YAxisUnit, StrokeEvent } from '../../../types/charts';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

interface GripForceChartProps {
  data: ChartDataPoint[];
  yAxisUnit: YAxisUnit;
  maxGripForce?: number; // For percent calculation
  currentTime?: number; // Video sync line
  strokeEvents?: StrokeEvent[]; // For annotations
  onTimeClick?: (time: number) => void;
  height?: number;
  windowSize?: number; // Sliding window size in seconds (if provided, shows data in sliding window)
}

export function GripForceChart({
  data,
  yAxisUnit,
  maxGripForce = 100,
  currentTime,
  strokeEvents = [],
  onTimeClick,
  height = 300,
  windowSize,
}: GripForceChartProps) {
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

  // Transform data based on yAxisUnit
  const chartData = useMemo(() => {
    const transformedData = data.map((point) => ({
      x: point.x,
      y: yAxisUnit === 'percent' ? (point.y / maxGripForce) * 100 : point.y,
    }));

    return {
      datasets: [
        {
          label: 'Grip Force',
          data: transformedData,
          borderColor: 'rgb(52, 152, 219)', // Blue
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.1,
          fill: true,
        },
      ],
    };
  }, [data, yAxisUnit, maxGripForce]);

  // Create annotations for stroke events and current time
  const annotations = useMemo(() => {
    const result: any = {};

    // Add stroke event vertical lines
    strokeEvents.forEach((stroke, index) => {
      const color =
        stroke.type === 'forehand'
          ? '#e67e22' // Orange
          : stroke.type === 'backhand'
          ? '#9b59b6' // Purple
          : '#27ae60'; // Green (serve)

      result[`stroke-${index}`] = {
        type: 'line',
        xMin: stroke.timestamp,
        xMax: stroke.timestamp,
        borderColor: color,
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          display: true,
          content: stroke.type.charAt(0).toUpperCase(),
          position: 'start',
          backgroundColor: color,
          color: '#fff',
          padding: 2,
          font: {
            size: 10,
          },
        },
      };
    });

    // Add current time line (video playback position)
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
  }, [strokeEvents, currentTime]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: `Grip Force (${yAxisUnit === 'N' ? 'Newtons' : '% Max Grip'})`,
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y.toFixed(1);
              return `Force: ${value}${yAxisUnit === 'N' ? 'N' : '%'}`;
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
          beginAtZero: true,
          title: {
            display: true,
            text: yAxisUnit === 'N' ? 'Force (N)' : 'Force (% max)',
          },
          max: yAxisUnit === 'percent' ? 100 : undefined,
        },
      },
      onClick: (event, elements, chart) => {
        if (!onTimeClick) return;

        // Get click position
        const canvasPosition = ChartJS.helpers.getRelativePosition(event, chart);

        // Convert to data coordinates
        const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);

        if (dataX !== undefined) {
          onTimeClick(dataX);
        }
      },
    }),
    [yAxisUnit, annotations, xAxisRange, onTimeClick]
  );

  return (
    <div style={{ height: `${height}px` }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
