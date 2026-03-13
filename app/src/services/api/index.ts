/**
 * API Service Layer
 *
 * Centralized exports for all API modules.
 */

// Client configuration and utilities
export {
  configureApi,
  getApiConfig,
  checkHealth,
  ApiClientError,
  type ApiConfig,
} from './client';

// Sessions API
export {
  createSession,
  listSessions,
  getSession,
  updateSession,
  deleteSession,
  uploadCalibration,
  type SessionCreateRequest,
  type SessionUpdateRequest,
  type SessionResponse,
  type SessionListResponse,
  type ListSessionsParams,
  type SessionMetadata,
  type CalibrationSample,
  type CalibrationUploadRequest,
} from './sessions';

// Sensor Data API
export {
  uploadSensorData,
  getSensorData,
  convertToApiFormat,
  type SensorSampleCreate,
  type SensorDataUploadRequest,
  type SensorDataUploadResponse,
  type SensorSampleResponse,
  type SensorDataResponse,
  type GetSensorDataParams,
} from './sensorData';

// Videos API
export {
  uploadVideo,
  getVideoMetadata,
  deleteVideo,
  getVideoStreamUrl,
  type VideoUploadResponse,
  type VideoMetadataResponse,
} from './videos';

// FSR Data API
export {
  uploadFSRData,
  getFSRData,
  convertFSRToApiFormat,
  type FSRSampleCreate,
  type FSRDataUploadRequest,
  type FSRDataUploadResponse,
  type FSRSampleResponse,
  type FSRDataResponse,
  type GetFSRDataParams,
} from './fsrData';

// Pain Notes API
export {
  uploadPainNotes,
  getPainNotes,
  convertPainNoteToApiFormat,
  type PainNoteCreate,
  type PainNotesUploadRequest,
  type PainNotesUploadResponse,
  type PainNoteResponse,
  type PainNotesResponse,
  type GetPainNotesParams,
} from './painNotes';
