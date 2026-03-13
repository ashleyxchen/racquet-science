import { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartOptions } from 'chart.js';
import type { StrokeStats } from '../../../types/charts';

ChartJS.register(ArcElement, Tooltip, Legend);

interface StrokeDistributionChartProps {
  stats: StrokeStats[];
}

const STROKE_COLORS = {
  forehand: '#e67e22', // Orange
  backhand: '#9b59b6', // Purple
  serve: '#27ae60', // Green
};

export function StrokeDistributionChart({ stats }: StrokeDistributionChartProps) {
  const chartData = useMemo(() => {
    const labels = stats.map(
      (s) => s.type.charAt(0).toUpperCase() + s.type.slice(1)
    );
    const data = stats.map((s) => s.count);
    const backgroundColor = stats.map((s) => STROKE_COLORS[s.type]);
    const borderColor = stats.map((s) => STROKE_COLORS[s.type]);

    return {
      labels,
      datasets: [
        {
          label: 'Strokes',
          data,
          backgroundColor,
          borderColor,
          borderWidth: 2,
        },
      ],
    };
  }, [stats]);

  const options: ChartOptions<'pie'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 14,
            },
          },
        },
        title: {
          display: true,
          text: 'Stroke Distribution',
          font: {
            size: 16,
            weight: 'bold',
          },
          padding: {
            bottom: 20,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const stat = stats[context.dataIndex];
              const lines = [
                `Count: ${stat.count}`,
                `Percentage: ${stat.percentage.toFixed(1)}%`,
              ];

              if (stat.avgGripForce !== undefined) {
                lines.push(`Avg Grip: ${stat.avgGripForce.toFixed(1)}N`);
              }

              if (stat.avgEfficiency !== undefined) {
                lines.push(`Avg Efficiency: ${stat.avgEfficiency.toFixed(1)}%`);
              }

              return lines;
            },
          },
        },
      },
    }),
    [stats]
  );

  // If no data, show placeholder
  if (stats.length === 0 || stats.every((s) => s.count === 0)) {
    return (
      <div
        style={{
          height: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#95a5a6',
          fontSize: '14px',
        }}
      >
        No stroke data available
      </div>
    );
  }

  return (
    <div style={{ height: '300px', padding: '20px' }}>
      <Pie data={chartData} options={options} />
    </div>
  );
}
