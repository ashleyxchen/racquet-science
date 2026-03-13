import { useNavigate } from 'react-router-dom';
import { useRecordingSession } from '../hooks/useRecordingSession';
import { useState } from 'react';

function RecordingPage() {
  const navigate = useNavigate();
  const [lastResult, setLastResult] = useState<any>(null);

  const {
    sessionId,
    isRecording,
    startTime,
    duration,
    videoStatus,
    watchStatus,
    error,
    startRecording,
    stopRecording,
    getSensorData,
  } = useRecordingSession();

  const handleStart = async () => {
    try {
      await startRecording();
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const handleStop = async () => {
    try {
      const result = await stopRecording();
      if (result) {
        setLastResult(result);
        console.log('Recording completed:', result);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return '--:--:--';
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'recording':
        return '#22c55e'; // green
      case 'error':
        return '#ef4444'; // red
      case 'disconnected':
        return '#f59e0b'; // amber
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div id="main">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Back
        </button>
        <div id="title">Record Session</div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Recording Status */}
        <div style={{
          background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)',
          border: `2px solid ${isRecording ? '#ef4444' : '#6b7280'}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isRecording ? '#ef4444' : '#6b7280',
              marginRight: '12px',
              animation: isRecording ? 'pulse 1.5s infinite' : 'none'
            }}></div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              {isRecording ? 'Recording in Progress' : 'Ready to Record'}
            </h2>
          </div>

          {sessionId && (
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              Session ID: {sessionId.substring(0, 8)}...
            </div>
          )}

          <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px' }}>
            {formatDuration(duration)}
          </div>

          {startTime && (
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Started at: {formatTime(startTime)}
            </div>
          )}
        </div>

        {/* Component Status */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
              Video Camera
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(videoStatus),
                marginRight: '8px'
              }}></div>
              {videoStatus}
            </div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
              Apple Watch
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(watchStatus),
                marginRight: '8px'
              }}></div>
              {watchStatus}
            </div>
          </div>
        </div>

        {/* Sensor Data Counter */}
        {isRecording && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '14px', color: '#1e40af', marginBottom: '4px' }}>
              Sensor Samples Collected
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>
              {getSensorData().length}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            color: '#991b1b'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Error</div>
            <div style={{ fontSize: '14px' }}>{error}</div>
          </div>
        )}

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={handleStart}
            disabled={isRecording}
            style={{
              flex: 1,
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: isRecording ? '#9ca3af' : '#ef4444',
              border: 'none',
              borderRadius: '8px',
              cursor: isRecording ? 'not-allowed' : 'pointer',
              opacity: isRecording ? 0.5 : 1
            }}
          >
            Start Recording
          </button>

          <button
            onClick={handleStop}
            disabled={!isRecording}
            style={{
              flex: 1,
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: !isRecording ? '#9ca3af' : '#1f2937',
              border: 'none',
              borderRadius: '8px',
              cursor: !isRecording ? 'not-allowed' : 'pointer',
              opacity: !isRecording ? 0.5 : 1
            }}
          >
            Stop Recording
          </button>
        </div>

        {/* Last Recording Result */}
        {lastResult && (
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
              Last Recording
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#4b5563' }}>
              <div><strong>Session ID:</strong> {lastResult.sessionId.substring(0, 13)}...</div>
              <div><strong>Duration:</strong> {formatDuration(lastResult.duration)}</div>
              <div><strong>Sensor Samples:</strong> {lastResult.sensorSamples.length}</div>
              {lastResult.videoPath && (
                <div><strong>Video:</strong> Saved</div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

export default RecordingPage;
