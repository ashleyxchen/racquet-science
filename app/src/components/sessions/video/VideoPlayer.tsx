import { useRef, useState, useEffect, useCallback } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  startTime?: number;  // For clipped playback
  endTime?: number;    // For clipped playback
  loop?: boolean;
  showSpeedControls?: boolean;
}

const SPEED_OPTIONS = [
  { value: 0.1, label: '0.1×' },
  { value: 0.25, label: '0.25×' },
  { value: 0.5, label: '0.5×' },
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1×' },
  { value: 1.25, label: '1.25×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
];

export function VideoPlayer({
  videoUrl,
  currentTime,
  onTimeUpdate,
  startTime,
  endTime,
  loop = false,
  showSpeedControls = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [customSpeed, setCustomSpeed] = useState('1');
  const [useCustomSpeed, setUseCustomSpeed] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);

  // Handle external currentTime changes (from chart clicks)
  // Only seek if the difference is significant (> 0.5 seconds) to avoid
  // feedback loop with onTimeUpdate
  useEffect(() => {
    if (videoRef.current && currentTime !== undefined) {
      const diff = Math.abs(videoRef.current.currentTime - currentTime);
      if (diff > 0.5) {
        videoRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime]);

  // Handle playback rate changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Set initial time if startTime is provided
  useEffect(() => {
    if (videoRef.current && startTime !== undefined) {
      videoRef.current.currentTime = startTime;
    }
  }, [startTime]);

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentVideoTime(time);
      onTimeUpdate?.(time);

      // Handle looping for clipped playback
      if (endTime && time >= endTime) {
        if (loop && startTime !== undefined) {
          videoRef.current.currentTime = startTime;
        } else {
          videoRef.current.pause();
        }
      }
    }
  }, [onTimeUpdate, endTime, loop, startTime]);

  // Handle speed selection
  const handleSpeedChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === 'custom') {
      setUseCustomSpeed(true);
      // Parse the custom speed input
      const customValue = parseFloat(customSpeed);
      if (!isNaN(customValue) && customValue > 0 && customValue <= 4) {
        setPlaybackRate(customValue);
      }
    } else {
      setUseCustomSpeed(false);
      const speed = parseFloat(value);
      setPlaybackRate(speed);
    }
  };

  // Handle custom speed input
  const handleCustomSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCustomSpeed(value);
  };

  // Apply custom speed
  const handleCustomSpeedApply = () => {
    const customValue = parseFloat(customSpeed);
    if (!isNaN(customValue) && customValue > 0 && customValue <= 4) {
      setPlaybackRate(customValue);
      setUseCustomSpeed(true);
    }
  };

  // Handle custom speed input on Enter key
  const handleCustomSpeedKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleCustomSpeedApply();
    }
  };

  // Format time for display (seconds to MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-player-container">
      <video
        ref={videoRef}
        className="video-player-element"
        src={videoUrl}
        controls
        onTimeUpdate={handleTimeUpdate}
        loop={loop && startTime === undefined && endTime === undefined}
      />

      {showSpeedControls && (
        <div className="video-speed-controls">
          <div className="video-speed-selector-row">
            <label htmlFor="speed-select">Playback Speed:</label>
            <select
              id="speed-select"
              className="video-speed-select"
              value={useCustomSpeed ? 'custom' : playbackRate.toString()}
              onChange={handleSpeedChange}
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>

          {useCustomSpeed && (
            <div className="video-custom-speed-row">
              <input
                type="number"
                className="video-speed-input"
                value={customSpeed}
                onChange={handleCustomSpeedChange}
                onKeyDown={handleCustomSpeedKeyDown}
                min="0.1"
                max="4"
                step="0.1"
                placeholder="Enter speed (0.1-4)"
              />
              <button
                className="video-speed-apply"
                onClick={handleCustomSpeedApply}
              >
                Apply
              </button>
            </div>
          )}

          <div className="video-speed-display">
            Current Speed: <strong>{playbackRate.toFixed(2)}×</strong>
          </div>

          {(startTime !== undefined || endTime !== undefined) && (
            <div className="video-clip-info">
              {startTime !== undefined && (
                <div>Start: {formatTime(startTime)}</div>
              )}
              {endTime !== undefined && (
                <div>End: {formatTime(endTime)}</div>
              )}
              {loop && <div className="loop-indicator">Loop: ON</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
