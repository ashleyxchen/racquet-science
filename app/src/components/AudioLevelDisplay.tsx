interface AudioLevelDisplayProps {
  dbLevel: number;
  isMuted: boolean;
  onMuteToggle: () => void;
}

function AudioLevelDisplay({ dbLevel, isMuted, onMuteToggle }: AudioLevelDisplayProps) {
  // Normalize dB level to 0-100% for the meter
  // dB range: -60 (silence) to 0 (max)
  const normalizedLevel = Math.max(0, Math.min(100, ((dbLevel + 60) / 60) * 100));

  // Determine color based on level
  const getBarColor = (level: number): string => {
    if (level < 50) return '#0A6C3B'; // Green
    if (level < 75) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  };

  return (
    <div className="audio-level-container">
      <div className="audio-level-row">
        <span className="audio-level-label">Level:</span>
        <div className="audio-meter-container">
          <div
            className="audio-meter-bar"
            style={{
              width: `${normalizedLevel}%`,
              backgroundColor: getBarColor(normalizedLevel),
            }}
          />
        </div>
        <span className="audio-db-value">{dbLevel.toFixed(1)} dB</span>
      </div>

      <button
        className={`mute-button ${isMuted ? 'muted' : ''}`}
        onClick={onMuteToggle}
      >
        {isMuted ? '🔇 Unmute' : '🔊 Mute'}
      </button>
    </div>
  );
}

export default AudioLevelDisplay;
