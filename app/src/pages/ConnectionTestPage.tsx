import { useWatchMotion } from '../hooks/useWatchMotion';
import { useRacketBle } from '../hooks/useRacketBle';
import DataSection from '../components/DataSection';
import MotionDataDisplay from '../components/MotionDataDisplay';

function ConnectionTestPage() {
  const { watchData, isConnected: watchConnected } = useWatchMotion();
  const {
    isConnected: racketConnected,
    charValue,
    connect,
    startListening,
  } = useRacketBle();
  

  return (
    <div id="main">
      <div id="title" style={{ paddingTop: 45 }}>
        Connection Test
      </div>

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
