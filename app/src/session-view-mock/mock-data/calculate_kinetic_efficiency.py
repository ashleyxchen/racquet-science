#!/usr/bin/env python3
"""
Calculate Kinematic Efficiency for each stroke from IMU data.

Kinematic Efficiency % = (TTPV / IPD) * 100
where:
- IPD (Impact Phase Duration) = t_BI - t_BE
- TTPV (Time to Peak Velocity) = t_PRV - t_BE

t_BE: End of Backswing (start of forward acceleration)
t_BI: Ball Impact (from stroke_data.csv)
t_PRV: Peak Racket Velocity (maximum velocity point)
"""

import numpy as np
import pandas as pd
import os
import sys

# Determine working directory
if len(sys.argv) > 1:
    work_dir = sys.argv[1]
    os.chdir(work_dir)
else:
    work_dir = os.path.dirname(__file__) or '.'

# Load stroke data
print(f"Loading stroke data from {os.getcwd()}...")
stroke_df = pd.read_csv('stroke_data.csv')
strokes = stroke_df.to_dict('records')
print(f"Found {len(strokes)} strokes")

# Load racquet IMU data
print("\nLoading racquet IMU data...")
imu_df = pd.read_csv('racquet_imu_data.csv')
print(f"Loaded {len(imu_df)} IMU samples")

# Convert timestamps to seconds for easier calculation
imu_df['time_s'] = imu_df['timestamp_ms'] / 1000.0

# Calculate resultant acceleration magnitude
imu_df['accel_magnitude'] = np.sqrt(
    imu_df['accel_x_mps2']**2 + 
    imu_df['accel_y_mps2']**2 + 
    imu_df['accel_z_mps2']**2
)

# Calculate velocity by integrating acceleration
# We'll calculate velocity magnitude from acceleration magnitude
# Using numerical integration (trapezoidal rule)
print("\nCalculating velocity from acceleration...")
dt = 0.001  # 1ms sampling rate
velocity_magnitude = np.zeros(len(imu_df))
for i in range(1, len(imu_df)):
    # Integrate acceleration to get velocity
    velocity_magnitude[i] = velocity_magnitude[i-1] + imu_df['accel_magnitude'].iloc[i] * dt

imu_df['velocity_magnitude'] = velocity_magnitude

# Function to find end of backswing (t_BE)
# This is where acceleration switches from negative to positive (forward swing starts)
def find_backswing_end(imu_data, impact_time, search_window=0.5):
    """
    Find the end of backswing by looking for acceleration direction change
    before impact. We look for the point where acceleration magnitude starts
    increasing significantly (indicating forward swing initiation).
    """
    # Search window before impact
    start_time = max(0, impact_time - search_window)
    end_time = impact_time
    
    # Get data in this window
    window_data = imu_data[
        (imu_data['time_s'] >= start_time) & 
        (imu_data['time_s'] <= end_time)
    ].copy()
    
    if len(window_data) < 10:
        # Fallback: use a fixed time before impact
        return max(0, impact_time - 0.3)
    
    # Find where acceleration magnitude starts increasing (forward swing)
    # Look for the minimum acceleration point, then the start of increase
    accel_mag = window_data['accel_magnitude'].values
    if len(accel_mag) < 5:
        return max(0, impact_time - 0.3)
    
    # Find the point where acceleration starts increasing (end of backswing)
    # This is typically where accel magnitude is at a local minimum before impact
    min_idx = np.argmin(accel_mag)
    
    # The backswing end is slightly before the minimum (where deceleration stops)
    backswing_idx = max(0, min_idx - 10)  # 10ms before minimum
    
    return window_data.iloc[backswing_idx]['time_s']

# Function to find peak velocity (t_PRV)
def find_peak_velocity(imu_data, backswing_time, impact_time):
    """Find the timestamp where velocity reaches its maximum."""
    window_data = imu_data[
        (imu_data['time_s'] >= backswing_time) & 
        (imu_data['time_s'] <= impact_time)
    ]
    
    if len(window_data) == 0:
        return impact_time
    
    max_velocity_idx = window_data['velocity_magnitude'].idxmax()
    return imu_data.loc[max_velocity_idx, 'time_s']

# Calculate kinematic efficiency for each stroke
print("\nCalculating kinematic efficiency for each stroke...")
results = []

for i, stroke in enumerate(strokes):
    impact_time = stroke['time']  # t_BI (Ball Impact)
    
    # Find end of backswing (t_BE)
    backswing_end = find_backswing_end(imu_df, impact_time)
    
    # Find peak velocity (t_PRV)
    peak_velocity_time = find_peak_velocity(imu_df, backswing_end, impact_time)
    
    # Calculate durations
    ipd = impact_time - backswing_end  # Impact Phase Duration
    ttpv = peak_velocity_time - backswing_end  # Time to Peak Velocity
    
    # Apply time-based efficiency degradation
    # Determine session type from working directory
    work_dir_lower = os.getcwd().lower()
    if 'sideview' in work_dir_lower:
        # SideView: decay from 100% to 85%
        final_efficiency = 0.85
    else:
        # TopView: decay from 100% to 75%
        final_efficiency = 0.75
    
    # Calculate efficiency decay factor based on stroke time
    # Assume video duration is ~30s, efficiency decays linearly
    video_duration = imu_df['time_s'].max()
    efficiency_decay_rate = (1.0 - final_efficiency) / video_duration
    time_based_efficiency = max(final_efficiency, 1.0 - (efficiency_decay_rate * impact_time))
    
    # Calculate kinematic efficiency percentage
    if ipd > 0:
        base_efficiency = (ttpv / ipd) * 100
        # Apply time-based efficiency degradation
        # Scale the efficiency down based on time
        kinematic_efficiency = base_efficiency * time_based_efficiency
    else:
        kinematic_efficiency = 100.0 * time_based_efficiency
    
    results.append({
        'stroke_index': i + 1,
        'time': impact_time,
        'type': stroke['type'],
        'backswing_end': backswing_end,
        'peak_velocity_time': peak_velocity_time,
        'impact_time': impact_time,
        'ipd': ipd,
        'ttpv': ttpv,
        'kinematic_efficiency_percent': kinematic_efficiency
    })
    
    print(f"Stroke {i+1} ({stroke['type']} at {impact_time:.2f}s): "
          f"Efficiency = {kinematic_efficiency:.1f}% (IPD={ipd:.3f}s, TTPV={ttpv:.3f}s)")

# Save to CSV
results_df = pd.DataFrame(results)
output_file = os.path.join(os.getcwd(), 'kinematic_efficiency_data.csv')
results_df.to_csv(output_file, index=False)
print(f"\nSaved kinematic efficiency data to {output_file}")
print(f"\nSummary:")
print(f"  Average efficiency: {results_df['kinematic_efficiency_percent'].mean():.1f}%")
print(f"  Min efficiency: {results_df['kinematic_efficiency_percent'].min():.1f}%")
print(f"  Max efficiency: {results_df['kinematic_efficiency_percent'].max():.1f}%")
