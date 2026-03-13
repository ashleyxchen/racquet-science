#!/usr/bin/env python3
"""
Import mock data from session-view-mock folder into the database.
This creates a demo session with sensor data and video.
"""

import csv
import sqlite3
import shutil
import os
from datetime import datetime, timedelta
from pathlib import Path

# Paths
MOCK_DATA_DIR = Path("../app/src/session-view-mock/mock-data/2024-01-15_Outdoor_Crosscourt_SideView")
MOCK_VIDEO = Path("../app/src/session-view-mock/mock-data/clipped_video_web.mp4")
DB_PATH = Path("./storage/sensor_recordings.db")
VIDEO_STORAGE_PATH = Path("./storage/videos")

def read_csv(filename):
    """Read CSV file and return list of dicts."""
    filepath = MOCK_DATA_DIR / filename
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        return list(reader)

def import_mock_data():
    """Import mock data into the database."""

    # Ensure storage directories exist
    VIDEO_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("Please start the backend server first to create the database.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Read calibration data
        calibration_data = read_csv("calibration.csv")
        pre_calibration = [float(row['sum']) for row in calibration_data if row['phase'] == 'pre']
        post_calibration = [float(row['sum']) for row in calibration_data if row['phase'] == 'post']
        max_pre_force = max(pre_calibration) if pre_calibration else None
        max_post_force = max(post_calibration) if post_calibration else None

        # Read IMU data to get duration
        hand_imu_data = read_csv("hand_imu_data.csv")
        racquet_imu_data = read_csv("racquet_imu_data.csv")

        # Get duration from last timestamp
        last_timestamp_ms = float(hand_imu_data[-1]['timestamp_ms'])
        duration_seconds = last_timestamp_ms / 1000

        print(f"Found {len(hand_imu_data)} hand IMU samples")
        print(f"Found {len(racquet_imu_data)} racquet IMU samples")
        print(f"Duration: {duration_seconds:.1f} seconds")
        print(f"Max pre-calibration force: {max_pre_force}")

        # Create session
        now = datetime.now()
        started_at = now - timedelta(seconds=duration_seconds)

        cursor.execute("""
            INSERT INTO sessions (
                created_at, updated_at, started_at, ended_at, duration, status,
                has_video, has_watch_data, has_arduino_data, video_path,
                session_metadata, planned_duration, recording_started_by,
                calibration_max_force, calibration_timestamp, calibration_duration_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            now.isoformat(),  # created_at
            now.isoformat(),  # updated_at
            started_at.isoformat(),  # started_at
            now.isoformat(),  # ended_at
            duration_seconds,  # duration
            'completed',  # status
            True,  # has_video
            True,  # has_watch_data (hand IMU)
            True,  # has_arduino_data (racquet IMU)
            None,  # video_path (will update after copying)
            '{"name": "Outdoor Crosscourt Session", "location": "Tennis Court", "notes": "Demo session with side view recording"}',
            30,  # planned_duration (minutes)
            'phone',  # recording_started_by
            max_pre_force,  # calibration_max_force
            started_at.isoformat(),  # calibration_timestamp
            5000,  # calibration_duration_ms
        ))

        session_id = cursor.lastrowid
        print(f"Created session with ID: {session_id}")

        # Copy video file
        video_filename = f"session_{session_id}.mp4"
        video_dest = VIDEO_STORAGE_PATH / video_filename
        if MOCK_VIDEO.exists():
            shutil.copy(MOCK_VIDEO, video_dest)
            cursor.execute(
                "UPDATE sessions SET video_path = ? WHERE id = ?",
                (str(video_dest), session_id)
            )
            print(f"Copied video to {video_dest}")
        else:
            print(f"Warning: Video file not found at {MOCK_VIDEO}")

        # Insert hand IMU data as "watch" source
        print("Importing hand IMU data as 'watch' source...")
        watch_samples = []
        for row in hand_imu_data:
            # Convert m/s² to g (divide by 9.81)
            accel_x = float(row['accel_x_mps2']) / 9.81
            accel_y = float(row['accel_y_mps2']) / 9.81
            accel_z = float(row['accel_z_mps2']) / 9.81

            watch_samples.append((
                session_id,
                'watch',
                int(float(row['timestamp_ms'])),
                (started_at + timedelta(milliseconds=float(row['timestamp_ms']))).isoformat(),
                accel_x,
                accel_y,
                accel_z,
                None, None, None,  # gyro (not in mock data)
                None, None, None,  # orientation
                None,  # heart_rate
            ))

        cursor.executemany("""
            INSERT INTO sensor_samples (
                session_id, source, relative_time_ms, absolute_timestamp,
                accel_x, accel_y, accel_z,
                gyro_x, gyro_y, gyro_z,
                orientation_roll, orientation_pitch, orientation_yaw,
                heart_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, watch_samples)
        print(f"Inserted {len(watch_samples)} watch samples")

        # Insert racquet IMU data as "arduino" source
        print("Importing racquet IMU data as 'arduino' source...")
        arduino_samples = []
        for row in racquet_imu_data:
            # Convert m/s² to g (divide by 9.81)
            accel_x = float(row['accel_x_mps2']) / 9.81
            accel_y = float(row['accel_y_mps2']) / 9.81
            accel_z = float(row['accel_z_mps2']) / 9.81

            arduino_samples.append((
                session_id,
                'arduino',
                int(float(row['timestamp_ms'])),
                (started_at + timedelta(milliseconds=float(row['timestamp_ms']))).isoformat(),
                accel_x,
                accel_y,
                accel_z,
                None, None, None,  # gyro
                None, None, None,  # orientation
                None,  # heart_rate
            ))

        cursor.executemany("""
            INSERT INTO sensor_samples (
                session_id, source, relative_time_ms, absolute_timestamp,
                accel_x, accel_y, accel_z,
                gyro_x, gyro_y, gyro_z,
                orientation_roll, orientation_pitch, orientation_yaw,
                heart_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, arduino_samples)
        print(f"Inserted {len(arduino_samples)} arduino samples")

        conn.commit()
        print(f"\n✅ Successfully imported mock data!")
        print(f"   Session ID: {session_id}")
        print(f"   Duration: {duration_seconds:.1f}s")
        print(f"   Watch samples: {len(watch_samples)}")
        print(f"   Arduino samples: {len(arduino_samples)}")
        print(f"   Video: {'Yes' if MOCK_VIDEO.exists() else 'No'}")
        print(f"\nYou can now view this session in the app at /sessions/{session_id}")

    except Exception as e:
        print(f"Error importing data: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    import_mock_data()
