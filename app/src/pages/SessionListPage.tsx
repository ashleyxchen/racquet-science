import { useNavigate } from 'react-router-dom';

function SessionListPage() {
  const navigate = useNavigate();

  return (
    <div id="main">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Back
        </button>
        <div id="title">Sessions</div>
      </div>

      <div className="placeholder-content">
        <p>No sessions recorded yet.</p>
        <button className="connect-button" onClick={() => navigate('/record')}>
          Record Your First Session
        </button>
      </div>
    </div>
  );
}

export default SessionListPage;
