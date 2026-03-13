#!/usr/bin/env python3
"""
Create sample data for testing the backend.
This script creates a session with sample sensor data.
"""

import asyncio
import sys
from datetime import datetime, timedelta
import random


async def create_sample_data():
    """Create a sample session with sensor data."""
    from app.database import async_session_maker, init_db
    from app.models import Session, SensorSample

    print("Initializing database...")
    await init_db()

    async with async_session_maker() as db:
        try:
            # Create a sample session
            print("\nCreating sample session...")
            session = Session(
                started_at=datetime.utcnow() - timedelta(minutes=5),
                ended_at=datetime.utcnow(),
                duration=300.0,
                status="completed",
                metadata={
                    "device": "iPhone 15 Pro",
                    "os_version": "iOS 17.2",
                    "app_version": "1.0.0"
                }
            )
            db.add(session)
            await db.flush()
            await db.refresh(session)
            print(f"✓ Created session #{session.id}")

            # Create sample sensor data (300 samples over 5 minutes)
            print("\nGenerating sensor data...")
            samples = []

            for i in range(300):
                relative_time_ms = i * 1000  # One sample per second

                # Watch data (every sample)
                watch_sample = SensorSample(
                    session_id=session.id,
                    source="watch",
                    relative_time_ms=relative_time_ms,
                    accel_x=random.uniform(-1.0, 1.0),
                    accel_y=random.uniform(-1.0, 1.0),
                    accel_z=random.uniform(9.0, 10.0),  # ~1g gravity
                    gyro_x=random.uniform(-0.5, 0.5),
                    gyro_y=random.uniform(-0.5, 0.5),
                    gyro_z=random.uniform(-0.5, 0.5),
                    orientation_roll=random.uniform(-3.14, 3.14),
                    orientation_pitch=random.uniform(-1.57, 1.57),
                    orientation_yaw=random.uniform(-3.14, 3.14),
                    heart_rate=random.uniform(60.0, 120.0)
                )
                samples.append(watch_sample)

                # Arduino data (every other sample)
                if i % 2 == 0:
                    arduino_sample = SensorSample(
                        session_id=session.id,
                        source="arduino",
                        relative_time_ms=relative_time_ms,
                        accel_x=random.uniform(-2.0, 2.0),
                        accel_y=random.uniform(-2.0, 2.0),
                        accel_z=random.uniform(8.0, 11.0),
                        gyro_x=random.uniform(-1.0, 1.0),
                        gyro_y=random.uniform(-1.0, 1.0),
                        gyro_z=random.uniform(-1.0, 1.0),
                    )
                    samples.append(arduino_sample)

            # Bulk insert
            db.add_all(samples)

            # Update session flags
            session.has_watch_data = True
            session.has_arduino_data = True

            await db.commit()

            print(f"✓ Created {len(samples)} sensor samples")
            print(f"  - Watch samples: {sum(1 for s in samples if s.source == 'watch')}")
            print(f"  - Arduino samples: {sum(1 for s in samples if s.source == 'arduino')}")

            print("\n" + "=" * 50)
            print("Sample data created successfully!")
            print("=" * 50)
            print(f"\nSession ID: {session.id}")
            print(f"Started: {session.started_at}")
            print(f"Ended: {session.ended_at}")
            print(f"Duration: {session.duration}s")
            print(f"\nView the session:")
            print(f"  curl http://localhost:8000/api/sessions/{session.id}")
            print(f"\nView sensor data stats:")
            print(f"  curl http://localhost:8000/api/sessions/{session.id}/sensor-data/stats")

            return 0

        except Exception as e:
            print(f"✗ Error creating sample data: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
            return 1


async def main():
    """Main entry point."""
    print("=" * 50)
    print("Sample Data Generator")
    print("=" * 50)

    return await create_sample_data()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
