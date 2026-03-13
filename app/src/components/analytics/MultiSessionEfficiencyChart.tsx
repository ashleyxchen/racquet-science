/**
 * MultiSessionEfficiencyChart - Kinematic efficiency by stroke type
 */

import { Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { EfficiencyByStrokeData, ANALYTICS_COLORS } from '../../types/analytics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MultiSessionEfficiencyChartProps {
  data: EfficiencyByStrokeData[];
  title?: string;
}

export function MultiSessionEfficiencyChart({ data, title = 'Kinematic Efficiency by Stroke' }: MultiSessionEfficiencyChartProps) {
  const navigate = useNavigate();

  if (data.length === 0) {
    return (
      <div className="analytics-chart-empty">
        <p>No efficiency data available for this period</p>
      </div>
    );
  }

  const chartData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Forehand',
        data: data.map(d => d.forehand),
        borderColor: ANALYTICS_COLORS.forehand,
        backgroundColor: `${ANALYTICS_COLORS.forehand}20`,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: ANALYTICS_COLORS.forehand,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
      {
        label: 'Backhand',
        data: data.map(d => d.backhand),
        borderColor: ANALYTICS_COLORS.backhand,
        backgroundColor: `${ANALYTICS_COLORS.backhand}20`,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: ANALYTICS_COLORS.backhand,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
      {
        label: 'Serve',
        data: data.map(d => d.serve),
        borderColor: ANALYTICS_COLORS.serve,
        backgroundColor: `${ANALYTICS_COLORS.serve}20`,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: ANALYTICS_COLORS.serve,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          color: ANALYTICS_COLORS.textPrimary,
        },
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        color: ANALYTICS_COLORS.textPrimary,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw?.toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: ANALYTICS_COLORS.textSecondary,
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: ANALYTICS_COLORS.gridLine,
        },
        ticks: {
          color: ANALYTICS_COLORS.textSecondary,
          callback: (value: any) => `${value}%`,
        },
      },
    },
    onClick: (_event: any, elements: any[]) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const sessionId = data[index].sessionId;
        navigate(`/sessions/${sessionId}`);
      }
    },
  };

  return (
    <div className="analytics-chart" style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

export default MultiSessionEfficiencyChart;
