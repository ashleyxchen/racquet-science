import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';
import {
  Session,
  SessionMetadata,
  SensorSample,
  EventMarker,
  CreateSessionInput,
  ListSessionsOptions,
  SessionData,
} from '../types/session';

const DB_NAME = 'grip_sense_db';
const SESSIONS_FOLDER = 'sessions';

class StorageService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private initialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check connection consistency (for web)
      if (Capacitor.getPlatform() === 'web') {
        await customElements.whenDefined('jeep-sqlite');
        const jeepSqliteEl = document.querySelector('jeep-sqlite');
        if (jeepSqliteEl != null) {
          await this.sqlite.initWebStore();
        }
      }

      // Create/open database
      this.db = await this.sqlite.createConnection(
        DB_NAME,
        false,
        'no-encryption',
        1,
        false
      );

      await this.db.open();

      // Create tables
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          duration INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'recording',
          sport_type TEXT,
          location TEXT,
          conditions TEXT,
          notes TEXT,
          video_path TEXT,
          has_watch_data INTEGER DEFAULT 0,
          has_racket_data INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_sport_type ON sessions(sport_type);
      `);

      // Ensure sessions folder exists
      try {
        await Filesystem.mkdir({
          path: SESSIONS_FOLDER,
          directory: Directory.Data,
          recursive: true,
        });
      } catch (e) {
        // Folder may already exist
      }

      this.initialized = true;
      console.log('StorageService initialized');
    } catch (error) {
      console.error('Failed to initialize StorageService:', error);
      throw error;
    }
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    await this.ensureInitialized();

    const id = uuidv4();
    const now = Date.now();

    const session: Session = {
      id,
      createdAt: now,
      updatedAt: now,
      duration: 0,
      status: 'recording',
      metadata: input.metadata,
      videoPath: null,
      hasWatchData: false,
      hasRacketData: false,
    };

    // Insert into database
    await this.db!.run(
      `INSERT INTO sessions (id, created_at, updated_at, status, sport_type, location, conditions, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.createdAt,
        session.updatedAt,
        session.status,
        session.metadata.sportType,
        session.metadata.location || null,
        session.metadata.conditions || null,
        session.metadata.notes || null,
      ]
    );

    // Create session folder
    await Filesystem.mkdir({
      path: `${SESSIONS_FOLDER}/${id}`,
      directory: Directory.Data,
      recursive: true,
    });

    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    await this.ensureInitialized();

    const result = await this.db!.query(
      'SELECT * FROM sessions WHERE id = ?',
      [id]
    );

    if (!result.values || result.values.length === 0) {
      return null;
    }

    return this.rowToSession(result.values[0]);
  }

  async listSessions(options?: ListSessionsOptions): Promise<Session[]> {
    await this.ensureInitialized();

    let query = 'SELECT * FROM sessions WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.sportType) {
      query += ' AND sport_type = ?';
      params.push(options.sportType);
    }

    if (options?.startDate) {
      query += ' AND created_at >= ?';
      params.push(options.startDate);
    }

    if (options?.endDate) {
      query += ' AND created_at <= ?';
      params.push(options.endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const result = await this.db!.query(query, params);

    if (!result.values) {
      return [];
    }

    return result.values.map((row) => this.rowToSession(row));
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    await this.ensureInitialized();

    const sets: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [Date.now()];

    if (updates.duration !== undefined) {
      sets.push('duration = ?');
      params.push(updates.duration);
    }

    if (updates.status !== undefined) {
      sets.push('status = ?');
      params.push(updates.status);
    }

    if (updates.videoPath !== undefined) {
      sets.push('video_path = ?');
      params.push(updates.videoPath);
    }

    if (updates.hasWatchData !== undefined) {
      sets.push('has_watch_data = ?');
      params.push(updates.hasWatchData ? 1 : 0);
    }

    if (updates.hasRacketData !== undefined) {
      sets.push('has_racket_data = ?');
      params.push(updates.hasRacketData ? 1 : 0);
    }

    if (updates.metadata) {
      if (updates.metadata.sportType) {
        sets.push('sport_type = ?');
        params.push(updates.metadata.sportType);
      }
      if (updates.metadata.location !== undefined) {
        sets.push('location = ?');
        params.push(updates.metadata.location || null);
      }
      if (updates.metadata.notes !== undefined) {
        sets.push('notes = ?');
        params.push(updates.metadata.notes || null);
      }
    }

    params.push(id);

    await this.db!.run(
      `UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
  }

  async deleteSession(id: string): Promise<void> {
    await this.ensureInitialized();

    // Delete from database
    await this.db!.run('DELETE FROM sessions WHERE id = ?', [id]);

    // Delete session folder and files
    try {
      await Filesystem.rmdir({
        path: `${SESSIONS_FOLDER}/${id}`,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {
      console.warn('Failed to delete session folder:', e);
    }
  }

  // Sensor data methods
  async appendSensorData(
    sessionId: string,
    source: 'watch' | 'racket',
    samples: SensorSample[]
  ): Promise<void> {
    await this.ensureInitialized();

    const filename = source === 'watch' ? 'watch-data.json' : 'racket-data.json';
    const path = `${SESSIONS_FOLDER}/${sessionId}/${filename}`;

    // Read existing data
    let existingData: SensorSample[] = [];
    try {
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      existingData = JSON.parse(result.data as string);
    } catch (e) {
      // File doesn't exist yet
    }

    // Append new samples
    const allData = [...existingData, ...samples];

    // Write back
    await Filesystem.writeFile({
      path,
      directory: Directory.Data,
      data: JSON.stringify(allData),
      encoding: Encoding.UTF8,
    });

    // Update session flag
    await this.updateSession(sessionId, {
      [source === 'watch' ? 'hasWatchData' : 'hasRacketData']: true,
    });
  }

  async getSensorData(
    sessionId: string,
    source: 'watch' | 'racket'
  ): Promise<SensorSample[]> {
    const filename = source === 'watch' ? 'watch-data.json' : 'racket-data.json';
    const path = `${SESSIONS_FOLDER}/${sessionId}/${filename}`;

    try {
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(result.data as string);
    } catch (e) {
      return [];
    }
  }

  // Markers
  async saveMarkers(sessionId: string, markers: EventMarker[]): Promise<void> {
    const path = `${SESSIONS_FOLDER}/${sessionId}/markers.json`;

    await Filesystem.writeFile({
      path,
      directory: Directory.Data,
      data: JSON.stringify(markers),
      encoding: Encoding.UTF8,
    });
  }

  async getMarkers(sessionId: string): Promise<EventMarker[]> {
    const path = `${SESSIONS_FOLDER}/${sessionId}/markers.json`;

    try {
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(result.data as string);
    } catch (e) {
      return [];
    }
  }

  // Video path helper
  getVideoPath(sessionId: string): string {
    return `${SESSIONS_FOLDER}/${sessionId}/video.mp4`;
  }

  async saveVideo(sessionId: string, tempPath: string): Promise<string> {
    const destPath = this.getVideoPath(sessionId);

    // Move video from temp to permanent location
    await Filesystem.copy({
      from: tempPath,
      to: destPath,
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });

    // Update session
    await this.updateSession(sessionId, { videoPath: destPath });

    return destPath;
  }

  // Full session data loader
  async getSessionData(sessionId: string): Promise<SessionData | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const [watchData, racketData, markers] = await Promise.all([
      this.getSensorData(sessionId, 'watch'),
      this.getSensorData(sessionId, 'racket'),
      this.getMarkers(sessionId),
    ]);

    return {
      session,
      watchData,
      racketData,
      markers,
    };
  }

  // Helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private rowToSession(row: Record<string, unknown>): Session {
    return {
      id: row.id as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      duration: row.duration as number,
      status: row.status as Session['status'],
      metadata: {
        sportType: (row.sport_type as Session['metadata']['sportType']) || 'other',
        location: row.location as string | undefined,
        conditions: row.conditions as string | undefined,
        notes: row.notes as string | undefined,
      },
      videoPath: row.video_path as string | null,
      hasWatchData: Boolean(row.has_watch_data),
      hasRacketData: Boolean(row.has_racket_data),
    };
  }
}

// Export singleton instance
export const storageService = new StorageService();
