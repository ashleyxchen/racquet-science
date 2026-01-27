import { useNavigate } from 'react-router-dom';

function RecordingPage() {
  const navigate = useNavigate();

  return (
    <div id="main">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Back
        </button>
        <div id="title">Record Session</div>
      </div>

      <div className="placeholder-content">
        <p>Recording functionality coming in Phase 3</p>
        <ul>
          <li>Video capture from iPhone camera</li>
          <li>Apple Watch IMU data</li>
          <li>Racket BLE sensor data</li>
          <li>Session metadata</li>
        </ul>
      </div>
    </div>
  );
}

export default RecordingPage;
