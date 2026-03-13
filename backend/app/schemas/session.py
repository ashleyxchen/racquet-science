from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class SessionCreate(BaseModel):
    """Request schema for creating a new session."""
    started_at: Optional[datetime] = None
    session_metadata: Optional[Dict[str, Any]] = None
    planned_duration: Optional[int] = Field(None, ge=1, le=180, description="Planned duration in minutes")
    recording_started_by: Optional[str] = Field(None, pattern="^(phone|watch)$")


class SessionUpdate(BaseModel):
    """Request schema for updating a session."""
    ended_at: Optional[datetime] = None
    duration: Optional[float] = None
    status: Optional[str] = None
    session_metadata: Optional[Dict[str, Any]] = None
    # Post-calibration fields
    post_calibration_max_force: Optional[float] = None
    post_calibration_timestamp: Optional[datetime] = None
    post_calibration_duration_ms: Optional[int] = None
    # Session summary fields
    avg_grip_force_at_impact: Optional[float] = None
    avg_acceleration_at_impact: Optional[float] = None
    avg_velocity_at_impact: Optional[float] = None
    avg_efficiency_forehand: Optional[float] = None
    avg_efficiency_backhand: Optional[float] = None
    avg_efficiency_serve: Optional[float] = None
    stroke_count_forehand: Optional[int] = None
    stroke_count_backhand: Optional[int] = None
    stroke_count_serve: Optional[int] = None


class SessionResponse(BaseModel):
    """Response schema for a single session."""
    id: int
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: Optional[float] = None
    status: str
    has_video: bool
    has_watch_data: bool
    has_arduino_data: bool
    has_fsr_data: bool = False
    has_pain_notes: bool = False
    video_path: Optional[str] = None
    session_metadata: Optional[Dict[str, Any]] = None
    sample_count: Optional[int] = None
    fsr_sample_count: Optional[int] = None
    pain_note_count: Optional[int] = None
    # Wizard/Planning fields
    planned_duration: Optional[int] = None
    recording_started_by: Optional[str] = None
    # Pre-calibration fields
    calibration_max_force: Optional[float] = None
    calibration_timestamp: Optional[datetime] = None
    calibration_duration_ms: Optional[int] = None
    # Post-calibration fields
    post_calibration_max_force: Optional[float] = None
    post_calibration_timestamp: Optional[datetime] = None
    post_calibration_duration_ms: Optional[int] = None
    # Session summary fields (computed from ball impact data)
    avg_grip_force_at_impact: Optional[float] = None
    avg_acceleration_at_impact: Optional[float] = None
    avg_velocity_at_impact: Optional[float] = None
    avg_efficiency_forehand: Optional[float] = None
    avg_efficiency_backhand: Optional[float] = None
    avg_efficiency_serve: Optional[float] = None
    stroke_count_forehand: int = 0
    stroke_count_backhand: int = 0
    stroke_count_serve: int = 0

    class Config:
        from_attributes = True


class CalibrationSampleCreate(BaseModel):
    """Schema for a single calibration sample."""
    timestamp: int = Field(..., description="Relative timestamp in ms from calibration start")
    force: float = Field(..., description="Force value")
    accel_x: Optional[float] = None
    accel_y: Optional[float] = None
    accel_z: Optional[float] = None
    gyro_x: Optional[float] = None
    gyro_y: Optional[float] = None
    gyro_z: Optional[float] = None


class CalibrationUpload(BaseModel):
    """Request schema for uploading calibration data."""
    max_force: float = Field(..., ge=0, description="Peak force achieved during calibration")
    timestamp: datetime = Field(..., description="When calibration was performed")
    duration_ms: int = Field(..., ge=0, description="Duration of calibration in milliseconds")
    samples: Optional[List[CalibrationSampleCreate]] = Field(None, description="Optional detailed samples")
    is_post_session: bool = Field(False, description="True if this is post-session calibration")


class SessionListResponse(BaseModel):
    """Response schema for listing sessions."""
    sessions: List[SessionResponse]
    total: int
    skip: int
    limit: int


class SensorSampleCreate(BaseModel):
    """Schema for creating a sensor sample."""
    source: str = Field(..., pattern="^(watch|arduino)$")
    relative_time_ms: int = Field(..., ge=0)
    absolute_timestamp: Optional[datetime] = None

    # Accelerometer
    accel_x: Optional[float] = None
    accel_y: Optional[float] = None
    accel_z: Optional[float] = None

    # Gyroscope
    gyro_x: Optional[float] = None
    gyro_y: Optional[float] = None
    gyro_z: Optional[float] = None

    # Orientation
    orientation_roll: Optional[float] = None
    orientation_pitch: Optional[float] = None
    orientation_yaw: Optional[float] = None

    # Heart rate (watch only)
    heart_rate: Optional[float] = Field(None, ge=0, le=300)

    @field_validator('source')
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in ['watch', 'arduino']:
            raise ValueError('source must be "watch" or "arduino"')
        return v


class SensorDataUpload(BaseModel):
    """Schema for bulk uploading sensor data."""
    samples: List[SensorSampleCreate]


class SensorSampleResponse(BaseModel):
    """Response schema for a sensor sample."""
    id: int
    session_id: int
    source: str
    relative_time_ms: int
    absolute_timestamp: Optional[datetime] = None
    accel_x: Optional[float] = None
    accel_y: Optional[float] = None
    accel_z: Optional[float] = None
    gyro_x: Optional[float] = None
    gyro_y: Optional[float] = None
    gyro_z: Optional[float] = None
    orientation_roll: Optional[float] = None
    orientation_pitch: Optional[float] = None
    orientation_yaw: Optional[float] = None
    heart_rate: Optional[float] = None

    class Config:
        from_attributes = True


# Pain Note Schemas

class PainNoteCreate(BaseModel):
    """Schema for creating a pain note."""
    note_id: str = Field(..., min_length=1, max_length=36, description="UUID from Watch")
    relative_time_ms: int = Field(..., ge=0, description="Milliseconds since session start")
    text: str = Field(..., min_length=1, description="Transcribed text from speech recognition")
    pain_level: int = Field(..., ge=1, le=10, description="Pain severity (1-10)")


class PainNotesUpload(BaseModel):
    """Schema for bulk uploading pain notes."""
    pain_notes: List[PainNoteCreate]


class PainNoteResponse(BaseModel):
    """Response schema for a pain note."""
    id: int
    session_id: int
    note_id: str
    relative_time_ms: int
    text: str
    pain_level: int
    created_at: datetime

    class Config:
        from_attributes = True


class PainNotesUploadResponse(BaseModel):
    """Response schema for pain notes upload."""
    session_id: int
    notes_created: int


# FSR Data Schemas

class FSRSampleCreate(BaseModel):
    """Schema for creating an FSR sample."""
    relative_time_ms: int = Field(..., ge=0, description="Milliseconds since session start")
    sequence: int = Field(..., ge=0, description="Sequence number for ordering")
    values: List[int] = Field(..., min_length=32, max_length=32, description="32 FSR values (4x8 grid, row-major order)")

    @field_validator('values')
    @classmethod
    def validate_values(cls, v: List[int]) -> List[int]:
        if len(v) != 32:
            raise ValueError('values must contain exactly 32 integers (4x8 grid)')
        return v


class FSRDataUpload(BaseModel):
    """Schema for bulk uploading FSR data."""
    samples: List[FSRSampleCreate]


class FSRSampleResponse(BaseModel):
    """Response schema for an FSR sample."""
    id: int
    session_id: int
    relative_time_ms: int
    sequence: int
    values: List[int]

    class Config:
        from_attributes = True


class FSRDataUploadResponse(BaseModel):
    """Response schema for FSR data upload."""
    session_id: int
    samples_created: int
