/**
 * GripForceTrendsChart
 *
 * Line chart showing grip force over time, grouped by stroke type.
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface GripForcePoint {
  time: number;
  force: number;
  type: 'forehand' | 'backhand' | 'serve';
}

interface GripForceTrendsChartProps {
  data: GripForcePoint[];
  yAxisUnit?: 'N' | 'percent';
  maxGripForce?: number;
  height?: number;
}

const STROKE_COLORS = {
  forehand: {
    border: '#e67e22',
    background: 'rgba(230, 126, 34, 0.2)',
  },
  backhand: {
    border: '#9b59b6',
    background: 'rgba(155, 89, 182, 0.2)',
  },
  serve: {
    border: '#27ae60',
    background: 'rgba(39, 174, 96, 0.2)',
  },
};

export function GripForceTrendsChart({
  data,
  yAxisUnit = 'N',
  maxGripForce = 100,
  height = 300,
}: GripForceTrendsChartProps) {
  const chartData = useMemo(() => {
    // Group data by stroke type
    const forehandData = data.filter(d => d.type === 'forehand');
    const backhandData = data.filter(d => d.type === 'backhand');
    const serveData = data.filter(d => d.type === 'serve');

    const transformForce = (force: number) =>
      yAxisUnit === 'percent' ? (force / maxGripForce) * 100 : force;

    return {
      datasets: [
        {
          label: 'Forehand',
          data: forehandData.map(d => ({ x: d.time, y: transformForce(d.force) })),
          borderColor: STROKE_COLORS.forehand.border,
          backgroundColor: STROKE_COLORS.forehand.background,
          fill: false,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
        {
          label: 'Backhand',
          data: backhandData.map(d => ({ x: d.time, y: transformForce(d.force) })),
          borderColor: STROKE_COLORS.backhand.border,
          backgroundColor: STROKE_COLORS.backhand.background,
          fill: false,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
        {
          label: 'Serve',
          data: serveData.map(d => ({ x: d.time, y: transformForce(d.force) })),
          borderColor: STROKE_COLORS.serve.border,
          backgroundColor: STROKE_COLORS.serve.background,
          fill: false,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
      ],
    };
  }, [data, yAxisUnit, maxGripForce]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const point = context.raw as { x: number; y: number };
            const unit = yAxisUnit === 'N' ? 'N' : '%';
            return `${context.dataset.label}: ${point.y.toFixed(1)}${unit} at ${point.x.toFixed(1)}s`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time (seconds)',
          font: { weight: 'bold' },
        },
        min: 0,
      },
      y: {
        title: {
          display: true,
          text: yAxisUnit === 'N' ? 'Force (N)' : '% of Max Grip',
          font: { weight: 'bold' },
        },
        min: 0,
      },
    },
  }), [yAxisUnit]);

  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95a5a6' }}>
        No grip force data available
      </div>
    );
  }

  return (
    <div style={{ height, padding: '10px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
