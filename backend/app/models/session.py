from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Session(Base):
    """Recording session model."""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Session timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Float, nullable=True)  # Duration in seconds

    # Session status
    status = Column(String(50), default="created", nullable=False)  # created, recording, completed

    # Data flags
    has_video = Column(Boolean, default=False, nullable=False)
    has_watch_data = Column(Boolean, default=False, nullable=False)
    has_arduino_data = Column(Boolean, default=False, nullable=False)
    has_fsr_data = Column(Boolean, default=False, nullable=False)

    # File storage
    video_path = Column(Text, nullable=True)

    # Additional metadata (named session_metadata to avoid SQLAlchemy reserved name)
    session_metadata = Column(JSON, nullable=True)

    # Wizard/Planning fields
    planned_duration = Column(Integer, nullable=True)  # Planned duration in minutes (50-80)
    recording_started_by = Column(String(20), nullable=True)  # 'phone' or 'watch'

    # Calibration data (pre-session)
    calibration_max_force = Column(Float, nullable=True)  # Peak grip force value
    calibration_timestamp = Column(DateTime(timezone=True), nullable=True)  # When calibration was done
    calibration_duration_ms = Column(Integer, nullable=True)  # How long calibration took
    calibration_samples = Column(JSON, nullable=True)  # Optional detailed calibration samples

    # Post-calibration data (end of session)
    post_calibration_max_force = Column(Float, nullable=True)  # Peak grip force at end of session
    post_calibration_timestamp = Column(DateTime(timezone=True), nullable=True)  # When post-calibration was done
    post_calibration_duration_ms = Column(Integer, nullable=True)  # How long post-calibration took

    # Session summary fields (computed from ball impact data)
    avg_grip_force_at_impact = Column(Float, nullable=True)  # Average grip force ±10ms around ball impacts
    avg_acceleration_at_impact = Column(Float, nullable=True)  # Average acceleration at impacts
    avg_velocity_at_impact = Column(Float, nullable=True)  # Average velocity at impacts

    # Efficiency by stroke type (computed averages)
    avg_efficiency_forehand = Column(Float, nullable=True)  # Average kinematic efficiency for forehands
    avg_efficiency_backhand = Column(Float, nullable=True)  # Average kinematic efficiency for backhands
    avg_efficiency_serve = Column(Float, nullable=True)  # Average kinematic efficiency for serves

    # Stroke counts
    stroke_count_forehand = Column(Integer, default=0, nullable=False)
    stroke_count_backhand = Column(Integer, default=0, nullable=False)
    stroke_count_serve = Column(Integer, default=0, nullable=False)

    # Data flag for pain notes
    has_pain_notes = Column(Boolean, default=False, nullable=False)

    # Relationships
    sensor_samples = relationship("SensorSample", back_populates="session", cascade="all, delete-orphan")
    fsr_samples = relationship("FSRSample", back_populates="session", cascade="all, delete-orphan")
    pain_notes = relationship("PainNote", back_populates="session", cascade="all, delete-orphan")


class SensorSample(Base):
    """Individual sensor data sample."""
    __tablename__ = "sensor_samples"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Data source
    source = Column(String(20), nullable=False, index=True)  # "watch" or "arduino"

    # Timing
    relative_time_ms = Column(Integer, nullable=False)  # Milliseconds since session start
    absolute_timestamp = Column(DateTime(timezone=True), nullable=True)  # Absolute time if available

    # Accelerometer data (in g)
    accel_x = Column(Float, nullable=True)
    accel_y = Column(Float, nullable=True)
    accel_z = Column(Float, nullable=True)

    # Gyroscope data (degrees/second)
    gyro_x = Column(Float, nullable=True)
    gyro_y = Column(Float, nullable=True)
    gyro_z = Column(Float, nullable=True)

    # Orientation data (radians)
    orientation_roll = Column(Float, nullable=True)
    orientation_pitch = Column(Float, nullable=True)
    orientation_yaw = Column(Float, nullable=True)

    # Heart rate (BPM, watch only)
    heart_rate = Column(Float, nullable=True)

    # Relationship
    session = relationship("Session", back_populates="sensor_samples")


class FSRSample(Base):
    """FSR pressure grid sample (4x8 grid = 32 values)."""
    __tablename__ = "fsr_samples"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Timing
    relative_time_ms = Column(Integer, nullable=False)  # Milliseconds since session start

    # Sequence number for ordering
    sequence = Column(Integer, nullable=False)

    # FSR values (stored as JSON array of 32 integers, row-major 4x8 grid)
    values = Column(JSON, nullable=False)

    # Relationship
    session = relationship("Session", back_populates="fsr_samples")


class PainNote(Base):
    """Voice-recorded pain note from Apple Watch."""
    __tablename__ = "pain_notes"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Original UUID from Watch
    note_id = Column(String(36), nullable=False, index=True)

    # Timing
    relative_time_ms = Column(Integer, nullable=False)  # Milliseconds since session start

    # Transcribed text
    text = Column(Text, nullable=False)

    # Pain severity (1-10)
    pain_level = Column(Integer, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship
    session = relationship("Session", back_populates="pain_notes")
