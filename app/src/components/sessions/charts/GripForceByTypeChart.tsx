/**
 * GripForceByTypeChart
 *
 * Bar chart showing average grip force by stroke type.
 */

import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import type { StrokeStats } from '../../../types/charts';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface GripForceByTypeChartProps {
  stats: StrokeStats[];
  yAxisUnit?: 'N' | 'percent';
  maxGripForce?: number;
  height?: number;
}

const STROKE_COLORS = {
  forehand: '#e67e22',
  backhand: '#9b59b6',
  serve: '#27ae60',
};

export function GripForceByTypeChart({
  stats,
  yAxisUnit = 'N',
  maxGripForce = 100,
  height = 300,
}: GripForceByTypeChartProps) {
  const chartData = useMemo(() => {
    const labels = stats.map(s => s.type.charAt(0).toUpperCase() + s.type.slice(1));
    const data = stats.map(s => {
      const force = s.avgGripForce || 0;
      return yAxisUnit === 'percent' ? (force / maxGripForce) * 100 : force;
    });
    const backgroundColor = stats.map(s => STROKE_COLORS[s.type]);

    return {
      labels,
      datasets: [
        {
          label: yAxisUnit === 'N' ? 'Avg Grip Force (N)' : 'Avg Grip Force (% max)',
          data,
          backgroundColor,
          borderColor: backgroundColor,
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 60,
        },
      ],
    };
  }, [stats, yAxisUnit, maxGripForce]);

  const options: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            const stat = stats[context.dataIndex];
            const lines = [
              `${yAxisUnit === 'N' ? `${value.toFixed(1)} N` : `${value.toFixed(1)}%`}`,
              `Count: ${stat.count} strokes`,
            ];
            if (stat.avgEfficiency !== undefined) {
              lines.push(`Avg Efficiency: ${stat.avgEfficiency.toFixed(1)}%`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: yAxisUnit === 'N' ? 'Force (N)' : '% of Max Grip',
          font: { weight: 'bold' },
        },
        beginAtZero: true,
        max: yAxisUnit === 'percent' ? 100 : undefined,
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  }), [stats, yAxisUnit]);

  if (stats.length === 0 || stats.every(s => !s.avgGripForce)) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95a5a6' }}>
        No grip force data available
      </div>
    );
  }

  return (
    <div style={{ height, padding: '10px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
