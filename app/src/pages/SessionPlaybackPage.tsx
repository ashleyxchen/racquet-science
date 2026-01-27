import { useNavigate, useParams } from 'react-router-dom';

function SessionPlaybackPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <div id="main">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/sessions')}>
          &larr; Back
        </button>
        <div id="title">Session Playback</div>
      </div>

      <div className="placeholder-content">
        <p>Session ID: {id}</p>
        <p>Playback functionality coming in Phase 4</p>
        <ul>
          <li>Video player with timeline</li>
          <li>Synchronized sensor graphs</li>
          <li>Event markers</li>
          <li>Export options</li>
        </ul>
      </div>
    </div>
  );
}

export default SessionPlaybackPage;
