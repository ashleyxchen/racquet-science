#!/usr/bin/env python3
"""
Generate fake data for a session in a specific folder.
Usage: python generate_session_data.py <session_folder> <video_path>
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
import os
import sys
from pathlib import Path

def get_video_duration(video_path):
    """Get video duration using ffprobe"""
    import subprocess
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
             '-of', 'default=noprint_wrappers=1:nokey=1', video_path],
            capture_output=True, text=True, check=True
        )
        return float(result.stdout.strip())
    except:
        # Fallback: estimate from file size or use default
        print(f"Warning: Could not get video duration from {video_path}, using default 30s")
        return 30.0

def generate_fake_data_for_session(session_folder, video_path=None, num_shots=None):
    """Generate fake data for a session"""
    session_path = Path(session_folder)
    session_path.mkdir(parents=True, exist_ok=True)
    
    # Get video duration
    if video_path and os.path.exists(video_path):
        video_duration = get_video_duration(video_path)
    else:
        video_duration = 30.096733  # Default
    
    video_duration_ms = video_duration * 1000
    
    # Estimate number of shots if not provided
    if num_shots is None:
        # Rough estimate: ~1.5 seconds per shot
        num_shots = max(15, int(video_duration / 1.5))
    
    avg_shot_duration = video_duration / num_shots
    
    # Generate stroke timings and types with variations
    print(f"Generating {num_shots} strokes for {video_duration:.2f}s video...")
    strokes = []
    
    # Randomly distribute strokes throughout the video
    stroke_types = ['forehand', 'backhand', 'serve']
    # Use different seeds based on session folder name to ensure different data
    seed_value = hash(session_folder) % 10000
    random.seed(seed_value)
    np.random.seed(seed_value)
    print(f"Using seed {seed_value} for session: {session_folder}")
    
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
    
    # Generate timestamps at 5ms intervals (200 Hz sampling rate)
    timestamps_ms = np.arange(0, int(video_duration_ms), 5)
    timestamps_s = timestamps_ms / 1000.0
    
    # 1. Generate grip force grid data (4x10 grid, 40 sensors)
    # Format: timestamp_ms, row, column, grip_force_N (one row per sensor per timestamp)
    print("\nGenerating grip force grid data...")
    grid_data = []
    for ts_ms, ts_s in zip(timestamps_ms, timestamps_s):
        # Find nearest stroke for this timestamp
        nearest_stroke = None
        min_dist = float('inf')
        for stroke in strokes:
            dist = abs(ts_s - stroke['time'])
            if dist < min_dist:
                min_dist = dist
                nearest_stroke = stroke
        
        # Base grip force varies with strokes
        # Add more noise and variation so the sum doesn't all look the same
        if nearest_stroke and min_dist < 0.5:  # Within 500ms of a stroke
            # Create a peak around the stroke
            time_from_stroke = ts_s - nearest_stroke['time']
            peak_force = nearest_stroke['grip_peak']
            rise_time = nearest_stroke['rise_time']
            
            # Gaussian-like peak with added variation
            if abs(time_from_stroke) < 0.3:
                multiplier = np.exp(-(time_from_stroke / rise_time) ** 2)
                base_force = peak_force * multiplier
                # Add noise and variation to make each stroke unique
                # Add random fluctuations (10-20% variation)
                noise_factor = 1.0 + np.random.normal(0, 0.15)  # ±15% noise
                base_force = base_force * noise_factor
                # Add some high-frequency variation
                high_freq_variation = np.sin(ts_s * 20) * 0.1  # Fast oscillation
                base_force = base_force * (1.0 + high_freq_variation)
            else:
                # Baseline with more variation
                base_force = 5.0 + np.random.uniform(-2, 2) + np.random.normal(0, 1)
        else:
            # Baseline with more variation and noise
            base_force = 5.0 + np.random.uniform(-2, 2) + np.random.normal(0, 1)
            # Add slow drift over time
            slow_drift = np.sin(ts_s * 0.5) * 1.5  # Slow oscillation
            base_force = base_force + slow_drift
        
        # Distribute force across 40 sensors (4 rows x 10 columns)
        # Create one row per sensor (format: timestamp_ms, row, column, grip_force_N)
        # Make individual sensors more distinguishable with higher peaks (at least 50N per sensor)
        # But keep sum reasonable (200-400N max)
        for row_idx in range(4):
            for col_idx in range(10):
                # Some sensors have more force (simulate grip pattern)
                # Add variation so each sensor has distinct characteristics
                # Use a fixed seed per sensor position for consistency
                sensor_seed = hash((row_idx, col_idx)) % 1000
                np.random.seed(sensor_seed + int(ts_ms / 100))  # Change every 100ms
                sensor_variation = np.random.uniform(0.5, 1.5)  # Per-sensor variation
                
                if row_idx < 2:  # Top rows (closer to handle) have more force
                    # Top rows: higher base force, can reach 50N+ peaks
                    # Distribute base_force unevenly - some sensors get much more
                    sensor_multiplier = np.random.uniform(0.5, 2.5)  # Some sensors 2.5x more
                    sensor_base = base_force * sensor_variation * sensor_multiplier * 0.3  # Moderate scaling
                    sensor_force = sensor_base * (1.0 + np.random.uniform(-0.15, 0.15))
                else:
                    # Bottom rows: lower force but still with variation
                    sensor_multiplier = np.random.uniform(0.1, 0.8)  # Lower multipliers
                    sensor_base = base_force * sensor_variation * sensor_multiplier * 0.3  # Moderate scaling
                    sensor_force = sensor_base * (1.0 + np.random.uniform(-0.15, 0.15))
                
                # Ensure peaks can reach at least 50N for individual sensors during strokes
                # When base_force is high (during strokes), some sensors should reach 50N+
                if base_force > 15:  # During stroke peaks
                    # Only scale up if this sensor is one of the "active" ones
                    if sensor_multiplier > 1.2:  # Top sensors
                        # Scale to allow 50N+ peaks for active sensors
                        # Calculate how much we need to scale to reach 50N
                        target_peak = 50.0
                        if sensor_force > 0 and sensor_force < target_peak:
                            scale_factor = target_peak / sensor_force
                            # Apply scaling but cap it to avoid excessive values
                            sensor_force = sensor_force * min(scale_factor, 4.0)  # Cap at 4x
                
                grid_data.append({
                    'timestamp_ms': int(ts_ms),
                    'row': row_idx,
                    'column': col_idx,
                    'grip_force_N': max(0, sensor_force)
                })
    
    grid_df = pd.DataFrame(grid_data)
    grid_output = session_path / 'grip_force_grid_data.csv'
    grid_df.to_csv(grid_output, index=False)
    print(f"Saved {len(grid_df)} sensor readings to {grid_output}")

    # Grip force total (sum per timestamp) - fast to load for charts; heat map uses grid on demand
    total_df = grid_df.groupby('timestamp_ms')['grip_force_N'].sum().reset_index()
    total_df.columns = ['timestamp_ms', 'grip_force_N']
    total_output = session_path / 'grip_force_total.csv'
    total_df.to_csv(total_output, index=False)
    print(f"Saved {len(total_df)} total grip force points to {total_output}")
    
    # 2. Generate stroke data CSV
    print("\nGenerating stroke data...")
    stroke_df = pd.DataFrame([{'time': s['time'], 'type': s['type']} for s in strokes])
    stroke_output = session_path / 'stroke_data.csv'
    stroke_df.to_csv(stroke_output, index=False)
    print(f"Saved {len(stroke_df)} strokes to {stroke_output}")
    
    # 3. Generate racquet IMU data with efficiency degradation over time
    print("\nGenerating racquet IMU data...")
    
    # Calculate efficiency decay parameters based on session
    # Different sessions will have different final efficiency values
    session_hash = hash(session_folder) % 10000
    # Final efficiency: SideView ~85%, TopView ~75% (or vice versa)
    if 'SideView' in session_folder:
        final_efficiency = 0.85  # 85% final efficiency
        efficiency_decay_rate = (1.0 - final_efficiency) / video_duration  # Linear decay
    else:
        final_efficiency = 0.75  # 75% final efficiency
        efficiency_decay_rate = (1.0 - final_efficiency) / video_duration
    
    print(f"Efficiency will decay from 100% to {final_efficiency*100:.1f}% over {video_duration:.1f}s")
    
    racquet_data = []
    for ts_ms, ts_s in zip(timestamps_ms, timestamps_s):
        # Find nearest stroke
        nearest_stroke = None
        min_dist = float('inf')
        stroke_time = None
        for stroke in strokes:
            dist = abs(ts_s - stroke['time'])
            if dist < min_dist:
                min_dist = dist
                nearest_stroke = stroke
                stroke_time = stroke['time']
        
        # Calculate efficiency factor based on time (decreases over time)
        # Efficiency at time t: 1.0 - (efficiency_decay_rate * t)
        efficiency_factor = max(final_efficiency, 1.0 - (efficiency_decay_rate * ts_s))
        
        # Base acceleration with stroke peaks
        if nearest_stroke and min_dist < 0.5:
            time_from_stroke = ts_s - stroke_time
            
            # Adjust the acceleration pattern to create efficiency degradation
            # Lower efficiency = peak velocity occurs earlier (smaller TTPV relative to IPD)
            # Strategy: Create acceleration that peaks earlier and then strongly decelerates before impact
            # This causes velocity to peak earlier relative to impact
            
            peak_mult = nearest_stroke['peak_multiplier']
            rise_time = nearest_stroke['rise_time']
            
            # Calculate efficiency-based timing adjustments
            # At 100% efficiency: acceleration peaks at impact (time_from_stroke = 0)
            # At lower efficiency: acceleration peaks earlier, then decelerates strongly
            efficiency_loss = 1.0 - efficiency_factor  # 0.0 to 0.25 (for 75-100% efficiency)
            
            # Peak acceleration occurs this much BEFORE impact (in seconds)
            # Higher loss = earlier peak (more pronounced)
            peak_offset_before_impact = efficiency_loss * 0.25  # Up to 250ms before impact for 75% efficiency
            
            # Time relative to the acceleration peak
            time_from_accel_peak = time_from_stroke + peak_offset_before_impact
            
            if abs(time_from_stroke) < 0.6:
                # Create acceleration pattern: rise to peak, then fall strongly
                if time_from_accel_peak < 0:
                    # Before acceleration peak: rising acceleration
                    # Use a smooth rise
                    normalized_time = time_from_accel_peak / (rise_time * 0.7)
                    multiplier = np.exp(-(normalized_time ** 2)) * peak_mult
                else:
                    # After acceleration peak: falling acceleration (deceleration phase)
                    # This creates earlier velocity peak
                    # More efficiency loss = much steeper deceleration
                    decel_rate = 0.3 + (efficiency_loss * 1.5)  # Much steeper fall for lower efficiency
                    normalized_time = time_from_accel_peak / (rise_time * decel_rate)
                    # Deceleration magnitude also reduces significantly with efficiency
                    decel_magnitude = 0.6 - (efficiency_loss * 0.4)  # Stronger reduction
                    multiplier = np.exp(-(normalized_time ** 2)) * peak_mult * decel_magnitude
                    
                    # Add negative acceleration component before impact for lower efficiency
                    if time_from_stroke > -0.1:  # Within 100ms of impact
                        negative_component = efficiency_loss * 0.3  # Negative acceleration near impact
                        multiplier = max(0.1, multiplier - negative_component)
            else:
                multiplier = 1.0
        else:
            multiplier = 1.0
        
        # Generate acceleration with noise and stroke peaks
        # Also add a slight overall reduction in acceleration magnitude over time (fatigue effect)
        base_accel = 2.0 * multiplier * (0.9 + 0.1 * efficiency_factor)
        accel_x = base_accel * np.random.uniform(0.8, 1.2) + np.random.normal(0, 0.5)
        accel_y = base_accel * np.random.uniform(0.8, 1.2) + np.random.normal(0, 0.5)
        accel_z = base_accel * np.random.uniform(0.8, 1.2) + np.random.normal(0, 0.5)
        
        racquet_data.append({
            'timestamp_ms': int(ts_ms),
            'accel_x_mps2': accel_x,
            'accel_y_mps2': accel_y,
            'accel_z_mps2': accel_z
        })
    
    racquet_df = pd.DataFrame(racquet_data)
    racquet_output = session_path / 'racquet_imu_data.csv'
    racquet_df.to_csv(racquet_output, index=False)
    print(f"Saved {len(racquet_df)} IMU samples to {racquet_output}")
    
    # 4. Generate hand IMU data (similar to racquet but with less variation)
    print("\nGenerating hand IMU data...")
    hand_data = []
    for ts_ms, ts_s in zip(timestamps_ms, timestamps_s):
        # Hand IMU is less variable than racquet
        base_accel = 1.5
        accel_x = base_accel + np.random.normal(0, 0.3)
        accel_y = base_accel + np.random.normal(0, 0.3)
        accel_z = base_accel + np.random.normal(0, 0.3)
        
        hand_data.append({
            'timestamp_ms': int(ts_ms),
            'accel_x_mps2': accel_x,
            'accel_y_mps2': accel_y,
            'accel_z_mps2': accel_z
        })
    
    hand_df = pd.DataFrame(hand_data)
    hand_output = session_path / 'hand_imu_data.csv'
    hand_df.to_csv(hand_output, index=False)
    print(f"Saved {len(hand_df)} IMU samples to {hand_output}")
    
    # 5. Generate pain data (dummy data: pain level 4 at 4s, level 2 at 6s)
    print("\nGenerating pain data...")
    pain_data = [
        {'timestamp_ms': 4000, 'pain_level': 4},
        {'timestamp_ms': 6000, 'pain_level': 2}
    ]
    pain_df = pd.DataFrame(pain_data)
    pain_output = session_path / 'pain_data.csv'
    pain_df.to_csv(pain_output, index=False)
    print(f"Saved {len(pain_df)} pain events to {pain_output}")
    
    # Also generate kinematic efficiency data
    print("\nCalculating kinematic efficiency...")
    try:
        import subprocess
        result = subprocess.run(
            ['python3', 'calculate_kinematic_efficiency.py', str(session_path)],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("Kinematic efficiency calculated successfully")
        else:
            print(f"Warning: Kinematic efficiency calculation had issues: {result.stderr}")
    except Exception as e:
        print(f"Warning: Could not calculate kinematic efficiency: {e}")
    
    # 6. Calibration: max grip strength before and after session (3 trials each, sum of grid)
    print("\nGenerating calibration data (max grip strength pre/post)...")
    cal_seed = (hash(session_folder) + 42) % 10000
    np.random.seed(cal_seed)
    # Pre-session: 3 trials, sum of 4x10 grid (typical max grip ~200-280 N total)
    pre_sums = [float(np.clip(np.random.normal(250, 15), 200, 300)) for _ in range(3)]
    # Post-session: slightly lower due to fatigue
    post_sums = [float(np.clip(np.random.normal(230, 12), 180, 280)) for _ in range(3)]
    cal_rows = (
        [{'phase': 'pre', 'trial': i + 1, 'sum': round(s, 2)} for i, s in enumerate(pre_sums)]
        + [{'phase': 'post', 'trial': i + 1, 'sum': round(s, 2)} for i, s in enumerate(post_sums)]
    )
    cal_df = pd.DataFrame(cal_rows)
    cal_output = session_path / 'calibration.csv'
    cal_df.to_csv(cal_output, index=False)
    print(f"Saved calibration (6 trials) to {cal_output}")
    
    print(f"\n✅ All data generated for session: {session_folder}")
    return session_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_session_data.py <session_folder> [video_path] [num_shots]")
        sys.exit(1)
    
    session_folder = sys.argv[1]
    video_path = sys.argv[2] if len(sys.argv) > 2 else None
    num_shots = int(sys.argv[3]) if len(sys.argv) > 3 else None
    
    generate_fake_data_for_session(session_folder, video_path, num_shots)
