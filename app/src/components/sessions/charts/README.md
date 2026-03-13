# Chart Components

This directory contains chart components for session data visualization.

## Components to Implement

### 1. GripForceChart.tsx
A line chart component for displaying grip force over time.

**Props:**
```typescript
interface GripForceChartProps {
  data: ChartDataPoint[];
  yAxisUnit: YAxisUnit;           // 'N' (Newtons) or 'percent' (% max grip)
  maxGripForce?: number;          // For converting to percentage
  currentTime?: number;           // For showing current position marker
  onChartClick?: (time: number) => void; // For seeking video on click
}
```

**Features:**
- Line chart using Chart.js or Recharts
- Y-axis switches between Newtons and % max grip
- Vertical line indicator showing current video time
- Click to seek video to that timestamp
- Hover tooltips showing exact values

### 2. IMUChart.tsx
A multi-line chart for 3-axis IMU data (accelerometer or gyroscope).

**Props:**
```typescript
interface IMUChartProps {
  data: {
    x: number[];
    y: number[];
    z: number[];
  };
  timestamps: number[];
  title: string;                  // e.g., "3-axis Acceleration (g)"
  currentTime?: number;
  onChartClick?: (time: number) => void;
}
```

**Features:**
- Three colored lines (X=red, Y=green, Z=blue)
- Vertical line indicator for current video time
- Click to seek video
- Legend showing which axis is which color
- Zoom/pan capabilities (optional)

### 3. EfficiencyChart.tsx (Future)
Similar to GripForceChart but specialized for kinematic efficiency metrics.

## Chart Library Recommendations

- **Chart.js** (with react-chartjs-2) - Good for simple, performant charts
- **Recharts** - More React-friendly, declarative API
- **Plotly.js** - Best for advanced interactivity and zoom/pan

## Data Flow

1. Parent component (`FullSessionTab`) passes sensor data
2. Chart components render using chosen library
3. User clicks on chart → `onChartClick(timestamp)` called
4. Parent updates `currentTime` state
5. `VideoPlayer` seeks to new time
6. All charts update their position indicators

## Example Implementation (Chart.js)

```typescript
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

export function GripForceChart({ data, yAxisUnit, currentTime, onChartClick }: GripForceChartProps) {
  // Convert data if needed
  const chartData = {
    labels: data.map(d => d.x),
    datasets: [{
      label: yAxisUnit === 'N' ? 'Grip Force (N)' : 'Grip Force (% max)',
      data: data.map(d => d.y),
      borderColor: 'rgb(249, 115, 22)',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
    }]
  };

  const options = {
    responsive: true,
    onClick: (event, elements) => {
      // Handle click to seek video
    },
    plugins: {
      annotation: {
        annotations: currentTime ? [{
          type: 'line',
          xMin: currentTime,
          xMax: currentTime,
          borderColor: 'red',
          borderWidth: 2,
        }] : []
      }
    }
  };

  return <Line data={chartData} options={options} />;
}
```

## Installation

```bash
npm install chart.js react-chartjs-2
# or
npm install recharts
```

## Styling

Chart containers should use these CSS classes:
- `.chart-section` - Wrapper with padding, background, shadow
- `.chart-canvas` - The actual chart element

Refer to `/Users/ashleychen/Developer/test-capacitor/app/src/css/style.css` for existing styles.
