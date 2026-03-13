import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

# Video duration in seconds (from merged video)
video_duration = 30.096733
video_duration_ms = video_duration * 1000

# Estimate number of shots: 20 clips merged
num_shots = 20
avg_shot_duration = video_duration / num_shots  # ~1.81 seconds per shot

# Generate stroke timings and types with variations
print(f"Generating {num_shots} strokes for {video_duration:.2f}s video...")
strokes = []

# Randomly distribute strokes throughout the video
# Each stroke has variations in timing, type, and characteristics
stroke_types = ['forehand', 'backhand', 'serve']
random.seed(42)  # For reproducibility
np.random.seed(42)

for i in range(num_shots):
    # Distribute strokes somewhat evenly but with some randomness
    base_time = (i * video_duration / num_shots)
    # Add small random variation (±0.2s)
    stroke_time = base_time + np.random.uniform(-0.2, 0.2)
    stroke_time = max(0.1, min(stroke_time, video_duration - 0.1))  # Keep within bounds
    
    # Randomly assign stroke type
    stroke_type = random.choice(stroke_types)
    
    # Store stroke characteristics for later use
    strokes.append({
        'time': stroke_time,
        'type': stroke_type,
        'peak_multiplier': np.random.uniform(0.7, 1.3),  # Variation in peak intensity
        'rise_time': np.random.uniform(0.05, 0.15),  # Time to reach peak (50-150ms)
        'grip_peak': np.random.uniform(12, 25)  # Peak grip force (12-25N)
    })

# Sort by time
strokes.sort(key=lambda x: x['time'])

print(f"Generated {len(strokes)} strokes:")
stroke_type_counts = {}
for stroke in strokes:
    stroke_type_counts[stroke['type']] = stroke_type_counts.get(stroke['type'], 0) + 1
for stroke_type, count in stroke_type_counts.items():
    print(f"  {stroke_type}: {count}")

# Generate grip force grid data (4 rows x 10 columns = 40 sensors per timestamp)
# Grid layout: 4 rows, 10 columns (10 bevels: 9 bevels with 1 column each, 1 fat bevel with 2 columns)
print("\nGenerating grip force grid data...")
grip_timestamps_5ms = np.arange(0, video_duration_ms, 5)
num_timestamps = len(grip_timestamps_5ms)
num_rows = 4
num_cols = 10
num_sensors = num_rows * num_cols  # 40 sensors

# Initialize grid data: each row is timestamp_ms, row, column, grip_force_N
grid_data = []

for i, timestamp in enumerate(grip_timestamps_5ms):
    timestamp_sec = timestamp / 1000.0
    
    # Base force for this timestamp (will be averaged)
    base_force = np.random.normal(5.0, 0.5)  # Baseline around 5N with noise
    
    # Add grip force increases during strokes with variations
    for stroke in strokes:
        stroke_time_ms = stroke['time'] * 1000
        distance_from_stroke = abs(timestamp - stroke_time_ms)
        
        # Wider window for grip force (grip increases before impact)
        if distance_from_stroke < 300:  # 300ms window
            # Calculate time relative to stroke (negative = before, positive = after)
            time_from_stroke = (timestamp - stroke_time_ms) / 1000.0
            
            # Grip force builds up before impact and peaks around impact
            if time_from_stroke < 0:
                # Building up: exponential rise
                build_up_factor = 1 - np.exp(time_from_stroke / stroke['rise_time'])
            else:
                # After impact: exponential decay
                build_up_factor = np.exp(-time_from_stroke / 0.1)
            
            # Apply stroke-specific peak and variation
            force_increase = stroke['grip_peak'] * build_up_factor * stroke['peak_multiplier']
            base_force += force_increase
    
    # Ensure no negative values
    base_force = max(base_force, 0.1)
    
    # Generate 40 individual sensor readings (4 rows x 10 columns)
    # Add spatial variation: different bevels have different force distributions
    for row in range(num_rows):
        for col in range(num_cols):
            # Spatial variation: center bevels (columns 4-5, the fat bevel) tend to have higher force
            if col in [4, 5]:  # Fat bevel (2 columns)
                sensor_force = base_force * np.random.normal(1.2, 0.15)  # Higher force on fat bevel
            elif col in [3, 6]:  # Adjacent bevels
                sensor_force = base_force * np.random.normal(1.0, 0.15)
            else:  # Other bevels
                sensor_force = base_force * np.random.normal(0.9, 0.15)
            
            # Row variation: middle rows (1-2) tend to have higher force
            if row in [1, 2]:
                sensor_force *= np.random.normal(1.1, 0.1)
            else:
                sensor_force *= np.random.normal(0.95, 0.1)
            
            # Ensure no negative values
            sensor_force = max(sensor_force, 0.05)
            
            grid_data.append({
                'timestamp_ms': timestamp,
                'row': row,
                'column': col,
                'grip_force_N': sensor_force
            })

# Save grid data
grid_df = pd.DataFrame(grid_data)
grid_df.to_csv('grip_force_grid_data.csv', index=False)
print(f"Created grip_force_grid_data.csv with {len(grid_df)} sensor readings ({num_timestamps} timestamps x {num_sensors} sensors)")

# Calculate average grip force per timestamp for the main chart
print("Calculating average grip force...")
grip_force_avg = grid_df.groupby('timestamp_ms')['grip_force_N'].mean().reset_index()
grip_force_avg.columns = ['timestamp_ms', 'grip_force_N']

grip_force_avg.to_csv('grip_force_data.csv', index=False)
print(f"Created grip_force_data.csv with {len(grip_force_avg)} averaged samples")

# Generate racquet IMU acceleration data (every 1ms)
print("\nGenerating racquet IMU acceleration data...")
racquet_timestamps_1ms = np.arange(0, video_duration_ms, 1)
# Baseline acceleration (gravity + small movements)
racquet_accel_x = np.random.normal(0, 0.5, len(racquet_timestamps_1ms))
racquet_accel_y = np.random.normal(0, 0.5, len(racquet_timestamps_1ms))
racquet_accel_z = np.random.normal(9.81, 0.5, len(racquet_timestamps_1ms))  # Gravity in z

# Add acceleration spikes during strokes with variations
for stroke in strokes:
    stroke_time_ms = stroke['time'] * 1000
    window_start = max(0, int(stroke_time_ms - 150))
    window_end = min(len(racquet_timestamps_1ms), int(stroke_time_ms + 150))
    
    # Variation in peak acceleration
    base_peak_accel = 30 * stroke['peak_multiplier']
    
    for i in range(window_start, window_end):
        distance_from_stroke = abs(racquet_timestamps_1ms[i] - stroke_time_ms)
        time_from_stroke = (racquet_timestamps_1ms[i] - stroke_time_ms) / 1000.0
        
        # Acceleration window: wider for serves, narrower for groundstrokes
        if stroke['type'] == 'serve':
            window_size = 100  # ms
        else:
            window_size = 80  # ms
        
        if distance_from_stroke < window_size:
            # Calculate acceleration with rise time variation
            if time_from_stroke < 0:
                # Building up to impact: exponential rise
                build_factor = 1 - np.exp(time_from_stroke / stroke['rise_time'])
            else:
                # After impact: exponential decay
                build_factor = np.exp(-abs(time_from_stroke) / 0.05)
            
            spike_magnitude = base_peak_accel * build_factor
            
            if stroke['type'] == 'backhand':
                # Backhand: more lateral movement (x-axis)
                racquet_accel_x[i] += spike_magnitude * np.random.choice([-1, 1]) * np.random.uniform(0.8, 1.2)
                racquet_accel_y[i] += spike_magnitude * 0.5 * np.random.uniform(0.7, 1.0)
            elif stroke['type'] == 'forehand':
                # Forehand: more forward movement (y-axis)
                racquet_accel_x[i] += spike_magnitude * 0.5 * np.random.uniform(0.7, 1.0)
                racquet_accel_y[i] += spike_magnitude * np.random.choice([-1, 1]) * np.random.uniform(0.8, 1.2)
            else:  # serve
                # Serve: strong upward and forward movement
                racquet_accel_x[i] += spike_magnitude * 0.3 * np.random.uniform(0.6, 1.0)
                racquet_accel_y[i] += spike_magnitude * 0.7 * np.random.uniform(0.8, 1.2)
                racquet_accel_z[i] += spike_magnitude * 0.8 * np.random.uniform(0.7, 1.0)  # Strong upward component
            
            # Z-axis acceleration for all strokes
            if stroke['type'] != 'serve':
                racquet_accel_z[i] += spike_magnitude * 0.3 * np.random.uniform(0.6, 1.0)

racquet_df = pd.DataFrame({
    'timestamp_ms': racquet_timestamps_1ms,
    'accel_x_mps2': racquet_accel_x,
    'accel_y_mps2': racquet_accel_y,
    'accel_z_mps2': racquet_accel_z
})
racquet_df.to_csv('racquet_imu_data.csv', index=False)
print(f"Created racquet_imu_data.csv with {len(racquet_df)} samples")

# Generate hand IMU acceleration data (every 1ms)
print("\nGenerating hand IMU acceleration data...")
hand_timestamps_1ms = np.arange(0, video_duration_ms, 1)
# Hand has less extreme movements than racquet
hand_accel_x = np.random.normal(0, 0.3, len(hand_timestamps_1ms))
hand_accel_y = np.random.normal(0, 0.3, len(hand_timestamps_1ms))
hand_accel_z = np.random.normal(9.81, 0.3, len(hand_timestamps_1ms))

# Add smaller acceleration changes during strokes (hand follows racquet but less extreme)
for stroke in strokes:
    stroke_time_ms = stroke['time'] * 1000
    window_start = max(0, int(stroke_time_ms - 150))
    window_end = min(len(hand_timestamps_1ms), int(stroke_time_ms + 150))
    
    # Hand acceleration is less extreme than racquet (about 1/3 the magnitude)
    base_peak_accel = 10 * stroke['peak_multiplier']
    
    for i in range(window_start, window_end):
        distance_from_stroke = abs(hand_timestamps_1ms[i] - stroke_time_ms)
        time_from_stroke = (hand_timestamps_1ms[i] - stroke_time_ms) / 1000.0
        
        if distance_from_stroke < 100:
            # Similar pattern to racquet but scaled down
            if time_from_stroke < 0:
                build_factor = 1 - np.exp(time_from_stroke / (stroke['rise_time'] * 1.2))  # Slightly slower
            else:
                build_factor = np.exp(-abs(time_from_stroke) / 0.08)
            
            spike_magnitude = base_peak_accel * build_factor
            
            if stroke['type'] == 'backhand':
                hand_accel_x[i] += spike_magnitude * 0.5 * np.random.choice([-1, 1]) * np.random.uniform(0.7, 1.0)
                hand_accel_y[i] += spike_magnitude * 0.3 * np.random.uniform(0.6, 1.0)
            elif stroke['type'] == 'forehand':
                hand_accel_x[i] += spike_magnitude * 0.3 * np.random.uniform(0.6, 1.0)
                hand_accel_y[i] += spike_magnitude * 0.5 * np.random.choice([-1, 1]) * np.random.uniform(0.7, 1.0)
            else:  # serve
                hand_accel_x[i] += spike_magnitude * 0.2 * np.random.uniform(0.5, 1.0)
                hand_accel_y[i] += spike_magnitude * 0.4 * np.random.uniform(0.6, 1.0)
                hand_accel_z[i] += spike_magnitude * 0.5 * np.random.uniform(0.6, 1.0)
            
            if stroke['type'] != 'serve':
                hand_accel_z[i] += spike_magnitude * 0.2 * np.random.uniform(0.5, 1.0)

hand_df = pd.DataFrame({
    'timestamp_ms': hand_timestamps_1ms,
    'accel_x_mps2': hand_accel_x,
    'accel_y_mps2': hand_accel_y,
    'accel_z_mps2': hand_accel_z
})
hand_df.to_csv('hand_imu_data.csv', index=False)
print(f"Created hand_imu_data.csv with {len(hand_df)} samples")

# Generate pain data (dummy data - just a couple of pain points)
print("\nGenerating pain data...")
pain_data = [
    {'time': 4.0, 'level': 4},
    {'time': 6.0, 'level': 2}
]
pain_df = pd.DataFrame(pain_data)
pain_df.to_csv('pain_data.csv', index=False)
print(f"Created pain_data.csv with {len(pain_df)} pain notes")

print("\n" + "="*70)
print("All data files generated successfully!")
print("="*70)
print(f"\nVideo duration: {video_duration:.2f} seconds")
print(f"Number of strokes: {len(strokes)}")
print(f"\nFirst 10 strokes:")
for i, stroke in enumerate(strokes[:10]):
    print(f"  {i+1}. {stroke['time']:.2f}s: {stroke['type']} (peak: {stroke['peak_multiplier']:.2f}x, rise: {stroke['rise_time']*1000:.0f}ms)")
print(f"\n... and {len(strokes)-10} more strokes")