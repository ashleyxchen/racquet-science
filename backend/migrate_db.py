#!/usr/bin/env python3
"""
Database migration script to add missing columns to the sessions table.
Run this script to update the database schema without losing existing data.
"""

import sqlite3
import os

# Database path (relative to backend directory)
DB_PATH = "./storage/sensor_recordings.db"


def get_existing_columns(cursor, table_name):
    """Get list of existing columns in a table."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def migrate():
    """Add missing columns to the sessions table."""
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        print("The database will be created automatically when you start the server.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Get existing columns
        existing_columns = get_existing_columns(cursor, "sessions")
        print(f"Existing columns: {existing_columns}")

        # Define new columns to add
        new_columns = [
            ("planned_duration", "INTEGER"),
            ("recording_started_by", "VARCHAR(20)"),
            ("calibration_max_force", "FLOAT"),
            ("calibration_timestamp", "DATETIME"),
            ("calibration_duration_ms", "INTEGER"),
            ("calibration_samples", "JSON"),
        ]

        # Add missing columns
        for column_name, column_type in new_columns:
            if column_name not in existing_columns:
                print(f"Adding column: {column_name} ({column_type})")
                cursor.execute(f"ALTER TABLE sessions ADD COLUMN {column_name} {column_type}")
            else:
                print(f"Column already exists: {column_name}")

        conn.commit()
        print("\nMigration completed successfully!")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
