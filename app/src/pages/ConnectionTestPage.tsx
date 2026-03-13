import { useWatchMotion } from '../hooks/useWatchMotion';
import { useWatchAudio } from '../hooks/useWatchAudio';
import { useRacketBle } from '../hooks/useRacketBle';
import { useRecordingSession, RecordingSessionResult } from '../hooks/useRecordingSession';
import { useSyncSession } from '../hooks/useSyncSession';
import { useState, useEffect } from 'react';
import DataSection from '../components/DataSection';
import MotionDataDisplay from '../components/MotionDataDisplay';
import AudioLevelDisplay from '../components/AudioLevelDisplay';
import VideoRecording from '../plugins/VideoRecording';

function ConnectionTestPage() {
  const { watchData, isConnected: watchConnected } = useWatchMotion();
  const { audioState, setMuted } = useWatchAudio();
  const {
    isConnected: racketConnected,
    charValue,
    connect,
    startListening,
  } = useRacketBle();

  // Recording session hook
  const {
    sessionId,
    isRecording,
    duration,
    videoStatus,
    watchStatus,
    error: recordingError,
    startRecording,
    stopRecording,
    getSensorData,
  } = useRecordingSession();

  // Store completed session result
  const [sessionResult, setSessionResult] = useState<RecordingSessionResult | null>(null);

  // Sync hook
  const {
    isSyncing,
    progress: syncProgress,
    lastResult: syncResult,
    isBackendAvailable: backendAvailable,
    error: syncError,
    syncSession,
    checkBackend,
  } = useSyncSession();

  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

  // Check backend availability on mount
  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  // Handle sync to backend
  const handleSyncToBackend = async () => {
    if (!sessionResult) return;

    const result = await syncSession(sessionResult, {
      metadata: {
        notes: 'Synced from ConnectionTestPage',
      },
    });

    if (result.success) {
      alert(`Session synced successfully! Backend ID: ${result.backendSessionId}`);
    } else {
      alert(`Sync failed: ${result.error}`);
    }
  };

  // Request camera/microphone permissions explicitly
  const handleRequestPermissions = async () => {
    try {
      console.log('Requesting camera permissions...');
      const result = await VideoRecording.requestPermissions();
      console.log('Permission result:', result);
      setPermissionStatus(`Camera: ${result.camera}, Mic: ${result.microphone}`);
      if (result.camera === 'granted' && result.microphone === 'granted') {
        alert('Permissions granted! You can now start recording.');
      } else {
        alert('Permissions denied. Please enable Camera and Microphone in Settings > Privacy.');
      }
    } catch (err) {
      console.error('Permission request failed:', err);
      alert('Failed to request permissions: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Format duration as mm:ss
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Handle start recording
  const handleStartRecording = async () => {
    try {
      setSessionResult(null); // Clear previous result
      await startRecording();
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    try {
      const result = await stopRecording();
      if (result) {
        setSessionResult(result);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      alert(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  };

  // Get recording status badge style
  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'recording':
        return 'connected'; // Reuse green style
      case 'error':
        return 'error';
      case 'disconnected':
        return 'warning';
      default:
        return '';
    }
  };

  return (
    <div id="main">
      <div id="title" style={{ paddingTop: 45 }}>
        Connection Test
      </div>

      {/* Recording Section */}
      <DataSection title="Recording Session">
        {/* Permission Request Button */}
        <div style={{ marginBottom: 15 }}>
          <button
            onClick={handleRequestPermissions}
            style={{
              backgroundColor: '#0A6C3B',
              color: 'white',
              padding: '10px 20px',
              fontSize: '14px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: 10,
            }}
          >
            Request Camera Permissions
          </button>
          {permissionStatus !== 'unknown' && (
            <div style={{ fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>
              {permissionStatus}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          {!isRecording ? (
            <button
              className="connect-button"
              onClick={handleStartRecording}
              style={{
                backgroundColor: '#0A6C3B',
                color: 'white',
                padding: '15px 30px',
                fontSize: '18px',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Start Recording
            </button>
          ) : (
            <button
              className="connect-button"
              onClick={handleStopRecording}
              style={{
                backgroundColor: '#f44336',
                color: 'white',
                padding: '15px 30px',
                fontSize: '18px',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Stop Recording
            </button>
          )}
        </div>

        {/* Recording Status */}
        {isRecording && (
          <div style={{ marginBottom: 15 }}>
            <div
              style={{
                backgroundColor: '#ffe0e0',
                border: '2px solid #ff4444',
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              RECORDING IN PROGRESS
            </div>
          </div>
        )}

        {/* Session Info */}
        {sessionId && (
          <div style={{ marginBottom: 10, fontSize: '12px', opacity: 0.7 }}>
            Session ID: {sessionId.substring(0, 8)}...
          </div>
        )}

        {/* Duration Display */}
        {isRecording && (
          <div style={{ marginBottom: 15, fontSize: '24px', fontWeight: 'bold', textAlign: 'center' }}>
            {formatDuration(duration)}
          </div>
        )}

        {/* Status Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: 15 }}>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: 5 }}>Video</div>
            <div className="status-indicator">
              <span className={getStatusBadgeClass(videoStatus)}>
                {videoStatus.charAt(0).toUpperCase() + videoStatus.slice(1)}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: 5 }}>Watch</div>
            <div className="status-indicator">
              <span className={getStatusBadgeClass(watchStatus)}>
                {watchStatus.charAt(0).toUpperCase() + watchStatus.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Sensor Sample Count */}
        {isRecording && (
          <div className="status-indicator" style={{ marginBottom: 10 }}>
            Sensor Samples: <strong>{getSensorData().length}</strong>
          </div>
        )}

        {/* Error Display */}
        {recordingError && (
          <div
            style={{
              backgroundColor: '#ffebee',
              border: '1px solid #f44336',
              borderRadius: '4px',
              padding: '10px',
              marginTop: 10,
              color: '#c62828',
              fontSize: '14px',
            }}
          >
            Error: {recordingError}
          </div>
        )}

        {/* Session Results */}
        {sessionResult && !isRecording && (
          <div
            style={{
              backgroundColor: '#e8f5e9',
              border: '2px solid #0A6C3B',
              borderRadius: '8px',
              padding: '15px',
              marginTop: 20,
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 10, color: '#2e7d32' }}>
              Recording Complete
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>Session ID:</strong> {sessionResult.sessionId.substring(0, 8)}...</div>
              <div><strong>Duration:</strong> {formatDuration(sessionResult.duration)}</div>
              <div><strong>Video Path:</strong> {sessionResult.videoPath || 'N/A'}</div>
              <div><strong>Sensor Samples:</strong> {sessionResult.sensorSamples.length}</div>
            </div>

            {/* Backend Status */}
            <div style={{ marginTop: 10, fontSize: '12px', opacity: 0.7 }}>
              Backend: {backendAvailable === null ? 'Checking...' : backendAvailable ? 'Available' : 'Unavailable'}
            </div>

            {/* Sync Progress */}
            {isSyncing && syncProgress && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '12px', marginBottom: 5 }}>{syncProgress.message}</div>
                <div
                  style={{
                    height: '8px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${syncProgress.progress}%`,
                      height: '100%',
                      backgroundColor: '#0A6C3B',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sync Error */}
            {syncError && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px',
                  backgroundColor: '#ffebee',
                  borderRadius: '4px',
                  color: '#c62828',
                  fontSize: '12px',
                }}
              >
                Sync Error: {syncError}
              </div>
            )}

            {/* Sync Success */}
            {syncResult?.success && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  color: '#1565c0',
                  fontSize: '12px',
                }}
              >
                Synced to backend! ID: {syncResult.backendSessionId}
              </div>
            )}

            <div style={{ marginTop: 10, display: 'flex', gap: '10px' }}>
              <button
                className="buttons"
                onClick={handleSyncToBackend}
                disabled={isSyncing || !backendAvailable}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: isSyncing ? '#9e9e9e' : backendAvailable ? '#0A6C3B' : '#bdbdbd',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSyncing || !backendAvailable ? 'not-allowed' : 'pointer',
                }}
              >
                {isSyncing ? 'Syncing...' : 'Sync to Backend'}
              </button>
              <button
                className="buttons"
                onClick={() => setSessionResult(null)}
                disabled={isSyncing}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#9e9e9e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </DataSection>

      <DataSection title="Apple Watch IMU">
        <div className="status-indicator">
          Status:{' '}
          <span
            id="watch-connection-status"
            className={watchConnected ? 'connected' : ''}
          >
            {watchConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <MotionDataDisplay data={watchData} />
      </DataSection>

      <DataSection title="Apple Watch Audio">
        <div className="status-indicator">
          Status:{' '}
          <span className={audioState.isReceiving ? 'connected' : ''}>
            {audioState.isReceiving ? 'Receiving Audio' : 'No Audio'}
          </span>
        </div>
        <AudioLevelDisplay
          dbLevel={audioState.dbLevel}
          isMuted={audioState.isMuted}
          onMuteToggle={() => setMuted(!audioState.isMuted)}
        />
      </DataSection>

      <DataSection title="Racket IMU">
        <button className="connect-button" onClick={connect}>
          Connect
        </button>
        <div className="status-indicator">
          Status:{' '}
          <span className={racketConnected ? 'connected' : ''}>
            {racketConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div id="char1-display">Char1:</div>
        <div id="char1">{charValue}</div>
        <button className="buttons" onClick={startListening}>
          Start Listen
        </button>
        <MotionDataDisplay data={null} />
      </DataSection>
    </div>
  );
}

export default ConnectionTestPage;
