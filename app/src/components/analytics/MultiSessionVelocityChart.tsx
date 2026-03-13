/**
 * MultiSessionVelocityChart - Average velocity at ball impact trend
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
import { AnalyticsChartDataPoint, ANALYTICS_COLORS } from '../../types/analytics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MultiSessionVelocityChartProps {
  data: AnalyticsChartDataPoint[];
  title?: string;
}

export function MultiSessionVelocityChart({ data, title = 'Avg Velocity at Impact' }: MultiSessionVelocityChartProps) {
  const navigate = useNavigate();

  if (data.length === 0) {
    return (
      <div className="analytics-chart-empty">
        <p>No velocity data available for this period</p>
      </div>
    );
  }

  const chartData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Velocity (m/s)',
        data: data.map(d => d.value),
        borderColor: '#e74c3c',
        backgroundColor: '#e74c3c20',
        fill: true,
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#e74c3c',
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
        display: false,
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
          label: (context: any) => `${context.raw?.toFixed(2)} m/s`,
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
        grid: {
          color: ANALYTICS_COLORS.gridLine,
        },
        ticks: {
          color: ANALYTICS_COLORS.textSecondary,
          callback: (value: any) => `${value} m/s`,
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
    <div className="analytics-chart" style={{ height: '250px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

export default MultiSessionVelocityChart;
