/**
 * SessionSummaryPage - Post-recording summary page (Strava-style)
 *
 * Allows users to name their session and add a description before finalizing.
 * Forward-only flow - no back button.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { updateSessionMetadata } from '../services/sessionStorage';
import { updateSession } from '../services/api/sessions';
import VideoRecording from '../plugins/VideoRecording';

// Route state interface
interface SessionSummaryRouteState {
  sessionId: string;
  startTime: number;
  duration: number;
  videoPath: string | null;
  watchSampleCount: number;
  arduinoSampleCount: number;
  fsrFrameCount: number;
  painNoteCount: number;
  backendSessionId?: number;
}

// Helper function to generate default session name based on time of day
function getDefaultSessionName(timestamp: number): string {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 12) return 'Morning Session';
  if (hour >= 12 && hour < 17) return 'Afternoon Session';
  if (hour >= 17 && hour < 21) return 'Evening Session';
  return 'Night Session';
}

// Helper function to format duration
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SessionSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as SessionSummaryRouteState | null;

  const [sessionName, setSessionName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize session name with default based on time of day
  useEffect(() => {
    if (routeState?.startTime) {
      setSessionName(getDefaultSessionName(routeState.startTime));
    }
  }, [routeState?.startTime]);

  // Redirect to sessions if no route state (direct navigation)
  useEffect(() => {
    if (!routeState) {
      console.log('[SessionSummaryPage] No route state, redirecting to sessions');
      navigate('/sessions', { replace: true });
    }
  }, [routeState, navigate]);

  // Restore webview visibility on mount (alpha was set to 0 during camera preview)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      console.log('[SessionSummaryPage] Restoring webview alpha to 1');
      VideoRecording.setWebViewAlpha({ alpha: 1 }).catch(console.error);
    }
  }, []);

  // Don't render if no route state
  if (!routeState) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Update local storage
      const localSuccess = await updateSessionMetadata(routeState.sessionId, {
        name: sessionName.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (!localSuccess) {
        console.warn('[SessionSummaryPage] Failed to update local metadata');
      }

      // Update backend if we have a backend session ID
      if (routeState.backendSessionId) {
        try {
          await updateSession(routeState.backendSessionId, {
            session_metadata: {
              name: sessionName.trim() || undefined,
              description: description.trim() || undefined,
            },
          });
          console.log('[SessionSummaryPage] Backend session updated');
        } catch (backendErr) {
          console.error('[SessionSummaryPage] Failed to update backend:', backendErr);
          // Don't block navigation, show warning
          setError('Session saved locally but failed to sync to cloud. You can try again later.');
          // Still navigate after a delay
          setTimeout(() => navigate('/sessions'), 2000);
          return;
        }
      }

      // Navigate to sessions list
      navigate('/sessions');
    } catch (err) {
      console.error('[SessionSummaryPage] Save error:', err);
      setError('Failed to save session. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // Navigate without saving metadata changes
    navigate('/sessions');
  };

  return (
    <div className="session-summary-page">
      <div className="session-summary-header">
        <h1>Session Complete</h1>
      </div>

      <div className="session-summary-content">
        {/* Success indicator */}
        <div className="session-saved-indicator">
          <div className="success-checkmark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span>Session Saved</span>
        </div>

        {/* Stats card */}
        <div className="session-stats-card">
          <div className="stat-row">
            <span className="stat-label">Duration</span>
            <span className="stat-value">{formatDuration(routeState.duration)}</span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Watch Data</span>
            <span className="stat-value">
              {routeState.watchSampleCount > 0 ? (
                <>
                  <span className="stat-check">✓</span>
                  {routeState.watchSampleCount.toLocaleString()} samples
                </>
              ) : (
                <span className="stat-none">—</span>
              )}
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Racket Data</span>
            <span className="stat-value">
              {routeState.arduinoSampleCount > 0 ? (
                <>
                  <span className="stat-check">✓</span>
                  {routeState.arduinoSampleCount.toLocaleString()} samples
                </>
              ) : (
                <span className="stat-none">—</span>
              )}
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Video</span>
            <span className="stat-value">
              {routeState.videoPath ? (
                <>
                  <span className="stat-check">✓</span>
                  Recorded
                </>
              ) : (
                <span className="stat-none">—</span>
              )}
            </span>
          </div>

          {routeState.fsrFrameCount > 0 && (
            <div className="stat-row">
              <span className="stat-label">Grip Force</span>
              <span className="stat-value">
                <span className="stat-check">✓</span>
                {routeState.fsrFrameCount.toLocaleString()} frames
              </span>
            </div>
          )}

          {routeState.painNoteCount > 0 && (
            <div className="stat-row">
              <span className="stat-label">Pain Notes</span>
              <span className="stat-value">
                <span className="stat-check">✓</span>
                {routeState.painNoteCount} notes
              </span>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="session-summary-form">
          <div className="form-group">
            <label htmlFor="session-name">Session Name</label>
            <input
              id="session-name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Enter session name..."
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="session-description">Description</label>
            <textarea
              id="session-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this session..."
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="session-summary-error">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="session-summary-actions">
          <button
            className="save-session-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Session'}
          </button>

          <button
            className="skip-button"
            onClick={handleSkip}
            disabled={isSaving}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionSummaryPage;
