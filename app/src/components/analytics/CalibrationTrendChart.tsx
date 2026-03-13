/**
 * CalibrationTrendChart - Pre and post calibration force trends
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

interface CalibrationTrendChartProps {
  preCalData: AnalyticsChartDataPoint[];
  postCalData: AnalyticsChartDataPoint[];
  title?: string;
}

export function CalibrationTrendChart({ preCalData, postCalData, title = 'Calibration Trends' }: CalibrationTrendChartProps) {
  const navigate = useNavigate();

  if (preCalData.length === 0 && postCalData.length === 0) {
    return (
      <div className="analytics-chart-empty">
        <p>No calibration data available for this period</p>
      </div>
    );
  }

  // Merge dates from both datasets
  const allDates = [...new Set([
    ...preCalData.map(d => d.date),
    ...postCalData.map(d => d.date),
  ])].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Create lookup maps
  const preCalMap = new Map(preCalData.map(d => [d.date, d]));
  const postCalMap = new Map(postCalData.map(d => [d.date, d]));

  const chartData = {
    labels: allDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Pre-Session',
        data: allDates.map(d => preCalMap.get(d)?.value ?? null),
        borderColor: ANALYTICS_COLORS.primary,
        backgroundColor: `${ANALYTICS_COLORS.primary}20`,
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: ANALYTICS_COLORS.primary,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        spanGaps: true,
      },
      {
        label: 'Post-Session',
        data: allDates.map(d => postCalMap.get(d)?.value ?? null),
        borderColor: '#9b59b6',
        backgroundColor: '#9b59b620',
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#9b59b6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        spanGaps: true,
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
          label: (context: any) => `${context.dataset.label}: ${context.raw?.toFixed(1)} N`,
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
          callback: (value: any) => `${value} N`,
        },
      },
    },
    onClick: (_event: any, elements: any[]) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const date = allDates[index];
        // Prefer pre-cal session ID, fallback to post-cal
        const sessionId = preCalMap.get(date)?.sessionId || postCalMap.get(date)?.sessionId;
        if (sessionId) {
          navigate(`/sessions/${sessionId}`);
        }
      }
    },
  };

  return (
    <div className="analytics-chart" style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

export default CalibrationTrendChart;
