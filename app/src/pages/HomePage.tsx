import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div id="main">
      <div id="title" style={{ paddingTop: 45 }}>
        Grip Sense
      </div>

      <div className="nav-grid">
        <button className="nav-card" onClick={() => navigate('/record')}>
          <div className="nav-card-icon">&#9899;</div>
          <div className="nav-card-title">Record Session</div>
          <div className="nav-card-desc">
            Capture video and sensor data
          </div>
        </button>

        <button className="nav-card" onClick={() => navigate('/sessions')}>
          <div className="nav-card-icon">&#128196;</div>
          <div className="nav-card-title">Sessions</div>
          <div className="nav-card-desc">
            View and analyze past sessions
          </div>
        </button>

        <button className="nav-card" onClick={() => navigate('/connection-test')}>
          <div className="nav-card-icon">&#128268;</div>
          <div className="nav-card-title">Connection Test</div>
          <div className="nav-card-desc">
            Test Watch and Racket connections
          </div>
        </button>
      </div>
    </div>
  );
}

export default HomePage;
