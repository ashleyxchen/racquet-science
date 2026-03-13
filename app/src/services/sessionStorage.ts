/**
 * Session Storage Service
 *
 * Provides methods to save, retrieve, and manage recording sessions
 * using localStorage for metadata and file system for sensor data.
 *
 * Note: For production, consider migrating to SQLite for better performance
 * with large datasets. SQLite is already installed (@capacitor-community/sqlite).
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import type { RecordingSessionResult } from '../hooks/useRecordingSession';
import type { Session, SensorSample, FSRSample, FSRDataFile, PainNote } from '../types/session';

const SESSIONS_KEY = 'recording_sessions';
const SENSOR_DATA_DIR = 'sensor_data';

// Track if directory has been verified to exist this session
let sensorDataDirExists = false;

/**
 * Ensure sensor_data directory exists (idempotent)
 */
async function ensureSensorDataDir(): Promise<void> {
  if (sensorDataDirExists) return;

  try {
    // Try to stat the directory first
    await Filesystem.stat({
      path: SENSOR_DATA_DIR,
      directory: Directory.Data,
    });
    sensorDataDirExists = true;
  } catch {
    // Directory doesn't exist, create it
    try {
      await Filesystem.mkdir({
        path: SENSOR_DATA_DIR,
        directory: Directory.Data,
        recursive: true,
      });
      sensorDataDirExists = true;
    } catch (mkdirErr: unknown) {
      // If error is "already exists", that's fine
      const errMsg = mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr);
      if (errMsg.includes('already exists')) {
        sensorDataDirExists = true;
      } else {
        throw mkdirErr;
      }
    }
  }
}

export interface StoredSession extends Session {
  sensorDataPath?: string;     // Path to JSON file containing Watch sensor samples
  racketDataPath?: string;     // Path to JSON file containing racket IMU samples
  fsrDataPath?: string;        // Path to JSON file containing FSR grid samples
  fsrFrameCount?: number;      // Total FSR frames collected
  painNotesPath?: string;      // Path to JSON file containing pain notes
  painNoteCount?: number;      // Total pain notes recorded
}

/**
 * Save a recording session to local storage
 */
export async function saveRecordingSession(
  result: RecordingSessionResult,
  metadata?: {
    location?: string;
    conditions?: string;
    notes?: string;
    tags?: string[];
  }
): Promise<StoredSession> {
  try {
    // Create session object
    const session: StoredSession = {
      id: result.sessionId,
      createdAt: result.startTime,
      updatedAt: result.endTime,
      duration: result.duration,
      status: 'completed',
      metadata: metadata || {},
      videoPath: result.videoPath,
      hasWatchData: result.sensorSamples.length > 0,
      hasRacketData: result.arduinoSamples.length > 0,
      hasFSRData: result.fsrSamples.length > 0,
    };

    // Save Watch sensor data to file system if present
    if (result.sensorSamples.length > 0) {
      const sensorDataPath = await saveSensorData(
        result.sessionId,
        result.sensorSamples,
        'watch'
      );
      session.sensorDataPath = sensorDataPath;
    }

    // Save racket IMU data to file system if present
    if (result.arduinoSamples.length > 0) {
      const racketDataPath = await saveSensorData(
        result.sessionId,
        result.arduinoSamples,
        'racket'
      );
      session.racketDataPath = racketDataPath;
    }

    // Save FSR data to file system if present
    if (result.fsrSamples.length > 0) {
      const fsrDataPath = await saveFSRData(result.sessionId, result.fsrSamples);
      session.fsrDataPath = fsrDataPath;
      session.fsrFrameCount = result.fsrSamples.length;
    }

    // Save pain notes to file system if present
    if (result.painNotes.length > 0) {
      const painNotesPath = await savePainNotes(result.sessionId, result.painNotes);
      session.painNotesPath = painNotesPath;
      session.painNoteCount = result.painNotes.length;
    }

    // Add to sessions list
    const sessions = await getAllSessions();
    sessions.push(session);

    // Save updated list to localStorage
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

    console.log('Session saved:', session.id, {
      watchSamples: result.sensorSamples.length,
      racketSamples: result.arduinoSamples.length,
      fsrFrames: result.fsrSamples.length,
      painNotes: result.painNotes.length,
    });
    return session;
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}

/**
 * Save sensor data to filesystem
 */
async function saveSensorData(
  sessionId: string,
  samples: SensorSample[],
  source: 'watch' | 'racket' = 'watch'
): Promise<string> {
  const filename = `${sessionId}_imu_${source}.json`;
  const path = `${SENSOR_DATA_DIR}/${filename}`;

  try {
    // Ensure directory exists (check first to avoid "already exists" error)
    await ensureSensorDataDir();

    // Write sensor data
    await Filesystem.writeFile({
      path,
      data: JSON.stringify(samples),
      directory: Directory.Data,
      encoding: 'utf8',
    });

    console.log(`Saved ${samples.length} ${source} IMU samples to ${path}`);
    return path;
  } catch (error) {
    console.error('Failed to save sensor data:', error);
    throw error;
  }
}

/**
 * Save FSR data to filesystem
 */
async function saveFSRData(
  sessionId: string,
  samples: FSRSample[]
): Promise<string> {
  const filename = `${sessionId}_fsr.json`;
  const path = `${SENSOR_DATA_DIR}/${filename}`;

  try {
    // Ensure directory exists
    await ensureSensorDataDir();

    // Create FSR data file structure
    const fsrDataFile: FSRDataFile = {
      version: 1,
      sessionId,
      frameCount: samples.length,
      sampleRate: 20, // ~20Hz FSR sample rate
      gridSize: { rows: 4, cols: 8 },
      samples,
    };

    // Write FSR data
    await Filesystem.writeFile({
      path,
      data: JSON.stringify(fsrDataFile),
      directory: Directory.Data,
      encoding: 'utf8',
    });

    console.log(`Saved ${samples.length} FSR frames to ${path}`);
    return path;
  } catch (error) {
    console.error('Failed to save FSR data:', error);
    throw error;
  }
}

/**
 * Save pain notes to filesystem
 */
async function savePainNotes(
  sessionId: string,
  painNotes: PainNote[]
): Promise<string> {
  const filename = `${sessionId}_pain_notes.json`;
  const path = `${SENSOR_DATA_DIR}/${filename}`;

  try {
    // Ensure directory exists
    await ensureSensorDataDir();

    // Write pain notes data
    await Filesystem.writeFile({
      path,
      data: JSON.stringify(painNotes),
      directory: Directory.Data,
      encoding: 'utf8',
    });

    console.log(`Saved ${painNotes.length} pain notes to ${path}`);
    return path;
  } catch (error) {
    console.error('Failed to save pain notes:', error);
    throw error;
  }
}

/**
 * Get all sessions from storage
 */
export async function getAllSessions(): Promise<StoredSession[]> {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);

    if (!stored) {
      return [];
    }

    const sessions = JSON.parse(stored) as StoredSession[];
    return sessions.sort((a, b) => b.createdAt - a.createdAt); // Sort by newest first
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return [];
  }
}

/**
 * Get a specific session by ID
 */
export async function getSession(sessionId: string): Promise<StoredSession | null> {
  try {
    const sessions = await getAllSessions();
    return sessions.find((s) => s.id === sessionId) || null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Get Watch sensor data for a session
 */
export async function getSensorData(sessionId: string): Promise<SensorSample[]> {
  try {
    const session = await getSession(sessionId);

    if (!session || !session.sensorDataPath) {
      console.warn('No sensor data path for session:', sessionId);
      return [];
    }

    const result = await Filesystem.readFile({
      path: session.sensorDataPath,
      directory: Directory.Data,
      encoding: 'utf8',
    });

    const samples = JSON.parse(result.data as string) as SensorSample[];
    console.log(`Loaded ${samples.length} Watch sensor samples for session ${sessionId}`);
    return samples;
  } catch (error) {
    console.error('Failed to load sensor data:', error);
    return [];
  }
}

/**
 * Get racket IMU data for a session
 */
export async function getRacketData(sessionId: string): Promise<SensorSample[]> {
  try {
    const session = await getSession(sessionId);

    if (!session || !session.racketDataPath) {
      console.warn('No racket data path for session:', sessionId);
      return [];
    }

    const result = await Filesystem.readFile({
      path: session.racketDataPath,
      directory: Directory.Data,
      encoding: 'utf8',
    });

    const samples = JSON.parse(result.data as string) as SensorSample[];
    console.log(`Loaded ${samples.length} racket IMU samples for session ${sessionId}`);
    return samples;
  } catch (error) {
    console.error('Failed to load racket data:', error);
    return [];
  }
}

/**
 * Get FSR data for a session
 */
export async function getFSRData(sessionId: string): Promise<FSRSample[]> {
  try {
    const session = await getSession(sessionId);

    if (!session || !session.fsrDataPath) {
      console.warn('No FSR data path for session:', sessionId);
      return [];
    }

    const result = await Filesystem.readFile({
      path: session.fsrDataPath,
      directory: Directory.Data,
      encoding: 'utf8',
    });

    const fsrDataFile = JSON.parse(result.data as string) as FSRDataFile;
    console.log(`Loaded ${fsrDataFile.frameCount} FSR frames for session ${sessionId}`);
    return fsrDataFile.samples;
  } catch (error) {
    console.error('Failed to load FSR data:', error);
    return [];
  }
}

/**
 * Get pain notes for a session
 */
export async function getPainNotes(sessionId: string): Promise<PainNote[]> {
  try {
    const session = await getSession(sessionId);

    if (!session || !session.painNotesPath) {
      console.warn('No pain notes path for session:', sessionId);
      return [];
    }

    const result = await Filesystem.readFile({
      path: session.painNotesPath,
      directory: Directory.Data,
      encoding: 'utf8',
    });

    const painNotes = JSON.parse(result.data as string) as PainNote[];
    console.log(`Loaded ${painNotes.length} pain notes for session ${sessionId}`);
    return painNotes;
  } catch (error) {
    console.error('Failed to load pain notes:', error);
    return [];
  }
}

/**
 * Delete a session and its associated data
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const sessions = await getAllSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      console.warn('Session not found:', sessionId);
      return false;
    }

    // Delete Watch sensor data file if it exists
    if (session.sensorDataPath) {
      try {
        await Filesystem.deleteFile({
          path: session.sensorDataPath,
          directory: Directory.Data,
        });
        console.log('Deleted Watch sensor data file:', session.sensorDataPath);
      } catch (err) {
        console.warn('Failed to delete Watch sensor data file:', err);
        // Continue anyway
      }
    }

    // Delete racket IMU data file if it exists
    if (session.racketDataPath) {
      try {
        await Filesystem.deleteFile({
          path: session.racketDataPath,
          directory: Directory.Data,
        });
        console.log('Deleted racket IMU data file:', session.racketDataPath);
      } catch (err) {
        console.warn('Failed to delete racket IMU data file:', err);
        // Continue anyway
      }
    }

    // Delete FSR data file if it exists
    if (session.fsrDataPath) {
      try {
        await Filesystem.deleteFile({
          path: session.fsrDataPath,
          directory: Directory.Data,
        });
        console.log('Deleted FSR data file:', session.fsrDataPath);
      } catch (err) {
        console.warn('Failed to delete FSR data file:', err);
        // Continue anyway
      }
    }

    // Delete pain notes file if it exists
    if (session.painNotesPath) {
      try {
        await Filesystem.deleteFile({
          path: session.painNotesPath,
          directory: Directory.Data,
        });
        console.log('Deleted pain notes file:', session.painNotesPath);
      } catch (err) {
        console.warn('Failed to delete pain notes file:', err);
        // Continue anyway
      }
    }

    // Delete video file and session directory if they exist
    // Video files are stored in Documents/sessions/{sessionId}/video.mp4
    if (session.videoPath) {
      try {
        let relativePath = session.videoPath;

        // Handle full path format (e.g., /var/mobile/.../Documents/sessions/uuid/video.mp4)
        if (session.videoPath.includes('/Documents/')) {
          relativePath = session.videoPath.split('/Documents/')[1];
        }

        // Delete the video file
        await Filesystem.deleteFile({
          path: relativePath,
          directory: Directory.Documents,
        });
        console.log('Deleted video file:', relativePath);

        // Try to delete the parent session directory (sessions/{sessionId}/)
        // This will fail silently if directory is not empty or doesn't exist
        try {
          const sessionDir = relativePath.replace('/video.mp4', '');
          await Filesystem.rmdir({
            path: sessionDir,
            directory: Directory.Documents,
          });
          console.log('Deleted session directory:', sessionDir);
        } catch (rmdirErr) {
          // Directory might not be empty or doesn't exist - that's okay
          console.log('Session directory cleanup skipped (may not be empty):', rmdirErr);
        }
      } catch (videoErr) {
        console.warn('Failed to delete video file:', videoErr);
        // Continue anyway - session metadata will still be deleted
      }
    }

    // Remove from sessions list
    const updatedSessions = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions));

    console.log('Session deleted:', sessionId);
    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

/**
 * Update session metadata
 */
export async function updateSessionMetadata(
  sessionId: string,
  metadata: Partial<Session['metadata']>
): Promise<boolean> {
  try {
    const sessions = await getAllSessions();
    const sessionIndex = sessions.findIndex((s) => s.id === sessionId);

    if (sessionIndex === -1) {
      console.warn('Session not found:', sessionId);
      return false;
    }

    // Update metadata
    sessions[sessionIndex].metadata = {
      ...sessions[sessionIndex].metadata,
      ...metadata,
    };
    sessions[sessionIndex].updatedAt = Date.now();

    // Save updated list
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

    console.log('Session metadata updated:', sessionId);
    return true;
  } catch (error) {
    console.error('Failed to update session metadata:', error);
    return false;
  }
}

/**
 * Clear all sessions (use with caution!)
 */
export async function clearAllSessions(): Promise<boolean> {
  try {
    // Get all sessions to delete their data files
    const sessions = await getAllSessions();

    for (const session of sessions) {
      // Delete Watch sensor data
      if (session.sensorDataPath) {
        try {
          await Filesystem.deleteFile({
            path: session.sensorDataPath,
            directory: Directory.Data,
          });
        } catch (err) {
          console.warn('Failed to delete Watch sensor data for session:', session.id);
        }
      }

      // Delete racket IMU data
      if (session.racketDataPath) {
        try {
          await Filesystem.deleteFile({
            path: session.racketDataPath,
            directory: Directory.Data,
          });
        } catch (err) {
          console.warn('Failed to delete racket IMU data for session:', session.id);
        }
      }

      // Delete FSR data
      if (session.fsrDataPath) {
        try {
          await Filesystem.deleteFile({
            path: session.fsrDataPath,
            directory: Directory.Data,
          });
        } catch (err) {
          console.warn('Failed to delete FSR data for session:', session.id);
        }
      }

      // Delete pain notes
      if (session.painNotesPath) {
        try {
          await Filesystem.deleteFile({
            path: session.painNotesPath,
            directory: Directory.Data,
          });
        } catch (err) {
          console.warn('Failed to delete pain notes for session:', session.id);
        }
      }

      // Delete video file and session directory
      if (session.videoPath) {
        try {
          let relativePath = session.videoPath;
          if (session.videoPath.includes('/Documents/')) {
            relativePath = session.videoPath.split('/Documents/')[1];
          }

          await Filesystem.deleteFile({
            path: relativePath,
            directory: Directory.Documents,
          });

          // Try to delete session directory
          const sessionDir = relativePath.replace('/video.mp4', '');
          try {
            await Filesystem.rmdir({
              path: sessionDir,
              directory: Directory.Documents,
            });
          } catch {
            // Directory might not be empty
          }
        } catch (err) {
          console.warn('Failed to delete video for session:', session.id);
        }
      }
    }

    // Clear localStorage
    localStorage.removeItem(SESSIONS_KEY);

    console.log('All sessions cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear sessions:', error);
    return false;
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalSessions: number;
  totalSamples: number;
  oldestSession: number | null;
  newestSession: number | null;
}> {
  try {
    const sessions = await getAllSessions();

    let totalSamples = 0;
    for (const session of sessions) {
      if (session.sensorDataPath) {
        try {
          const samples = await getSensorData(session.id);
          totalSamples += samples.length;
        } catch (err) {
          console.warn('Failed to count samples for session:', session.id);
        }
      }
    }

    return {
      totalSessions: sessions.length,
      totalSamples,
      oldestSession: sessions.length > 0 ? sessions[sessions.length - 1].createdAt : null,
      newestSession: sessions.length > 0 ? sessions[0].createdAt : null,
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return {
      totalSessions: 0,
      totalSamples: 0,
      oldestSession: null,
      newestSession: null,
    };
  }
}
