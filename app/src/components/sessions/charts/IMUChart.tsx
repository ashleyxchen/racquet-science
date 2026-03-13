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
import type { SensorDataForCharts } from '../../../types/sessionDetail';

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

interface IMUChartProps {
  data: SensorDataForCharts;
  type: 'accel' | 'gyro';
  title: string;
  currentTime?: number;
  onTimeClick?: (time: number) => void;
  height?: number;
  windowSize?: number; // Sliding window size in seconds
}

export function IMUChart({
  data,
  type,
  title,
  currentTime,
  onTimeClick,
  height = 300,
  windowSize,
}: IMUChartProps) {
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
    const sensorData = type === 'accel' ? data.accel : data.gyro;
    const { timestamps } = data;

    return {
      datasets: [
        {
          label: 'X-axis',
          data: timestamps.map((t, i) => ({ x: t, y: sensorData.x[i] })),
          borderColor: 'rgb(231, 76, 60)', // Red
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 2,
          tension: 0.1,
        },
        {
          label: 'Y-axis',
          data: timestamps.map((t, i) => ({ x: t, y: sensorData.y[i] })),
          borderColor: 'rgb(46, 204, 113)', // Green
          backgroundColor: 'rgba(46, 204, 113, 0.1)',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 2,
          tension: 0.1,
        },
        {
          label: 'Z-axis',
          data: timestamps.map((t, i) => ({ x: t, y: sensorData.z[i] })),
          borderColor: 'rgb(52, 152, 219)', // Blue
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 2,
          tension: 0.1,
        },
      ],
    };
  }, [data, type]);

  // Create annotation for current time
  const annotations = useMemo(() => {
    const result: any = {};

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
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            pointStyleWidth: 6,
            boxWidth: 3,
            boxHeight: 4,
            font: {
              size: 11,
            },
            padding: 8,
          },
        },
        title: {
          display: true,
          text: title,
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y.toFixed(2);
              const unit = type === 'accel' ? 'g' : '°/s';
              return `${label}: ${value} ${unit}`;
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
          title: {
            display: true,
            text: type === 'accel' ? 'Acceleration (g)' : 'Angular Velocity (°/s)',
          },
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
    [title, type, annotations, xAxisRange, onTimeClick]
  );

  return (
    <div style={{ height: `${height}px` }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
