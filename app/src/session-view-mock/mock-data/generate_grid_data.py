#!/usr/bin/env python3
import random
import math

# Video duration in seconds
video_duration = 7.091992
video_duration_ms = video_duration * 1000

# Stroke timings (in seconds)
strokes = [
    {'time': 2.0, 'type': 'backhand'},
    {'time': 4.0, 'type': 'backhand'},
    {'time': 5.0, 'type': 'forehand'}
]

# Generate timestamps every 5ms
grip_timestamps_5ms = []
t = 0
while t < video_duration_ms:
    grip_timestamps_5ms.append(t)
    t += 5

num_rows = 4
num_cols = 10
num_sensors = num_rows * num_cols  # 40 sensors

# Initialize grid data
grid_data = []

print(f"Generating grip force grid data for {len(grip_timestamps_5ms)} timestamps...")

for timestamp in grip_timestamps_5ms:
    # Base force for this timestamp
    base_force = random.gauss(5.0, 0.5)  # Baseline around 5N with noise
    
    # Add grip force increases during strokes
    for stroke in strokes:
        stroke_time_ms = stroke['time'] * 1000
        distance_from_stroke = abs(timestamp - stroke_time_ms)
        if distance_from_stroke < 200:
            # Peak force around 15-20N during stroke
            force_increase = 15 * math.exp(-distance_from_stroke / 100)
            base_force += force_increase
    
    # Ensure no negative values
    base_force = max(base_force, 0.1)
    
    # Generate 40 individual sensor readings (4 rows x 10 columns)
    for row in range(num_rows):
        for col in range(num_cols):
            # Spatial variation: center bevels (columns 4-5, the fat bevel) tend to have higher force
            if col in [4, 5]:  # Fat bevel (2 columns)
                sensor_force = base_force * random.gauss(1.2, 0.15)
            elif col in [3, 6]:  # Adjacent bevels
                sensor_force = base_force * random.gauss(1.0, 0.15)
            else:  # Other bevels
                sensor_force = base_force * random.gauss(0.9, 0.15)
            
            # Row variation: middle rows (1-2) tend to have higher force
            if row in [1, 2]:
                sensor_force *= random.gauss(1.1, 0.1)
            else:
                sensor_force *= random.gauss(0.95, 0.1)
            
            # Ensure no negative values
            sensor_force = max(sensor_force, 0.05)
            
            grid_data.append({
                'timestamp_ms': timestamp,
                'row': row,
                'column': col,
                'grip_force_N': sensor_force
            })

# Write to CSV
with open('grip_force_grid_data.csv', 'w') as f:
    f.write('timestamp_ms,row,column,grip_force_N\n')
    for data in grid_data:
        f.write(f"{data['timestamp_ms']},{data['row']},{data['column']},{data['grip_force_N']:.6f}\n")

print(f"Created grip_force_grid_data.csv with {len(grid_data)} sensor readings")
print(f"({len(grip_timestamps_5ms)} timestamps × {num_sensors} sensors)")

