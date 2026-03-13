import { useNavigate } from 'react-router-dom';
import { useSessionsList } from '../hooks/useSessionsList';
import { SessionCard } from '../components/sessions/SessionCard';

// Back arrow icon
function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  );
}

// Search icon
function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

// Loading state component
function LoadingState() {
  return (
    <div className="sessions-loading-state">
      <div className="spinner"></div>
      <p>Loading sessions...</p>
    </div>
  );
}

// Empty state component
function EmptyState({ searchQuery, onStartRecording }: { searchQuery: string; onStartRecording: () => void }) {
  if (searchQuery) {
    return (
      <div className="sessions-empty-state">
        <p>No sessions found matching "{searchQuery}"</p>
        <p className="sessions-empty-hint">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="sessions-empty-state">
      <p>No sessions recorded yet.</p>
      <button className="connect-button" onClick={onStartRecording}>
        Record Your First Session
      </button>
    </div>
  );
}

// Error state component
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="sessions-error-state">
      <p className="error-message">Failed to load sessions</p>
      <p className="error-detail">{error}</p>
      <button className="connect-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export default function SessionListPage() {
  const navigate = useNavigate();
  const {
    groupedSessions,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    refresh
  } = useSessionsList();

  const handleSessionClick = (sessionId: number) => {
    navigate(`/sessions/${sessionId}`);
  };

  const handleStartRecording = () => {
    navigate('/record');
  };

  return (
    <div className="sessions-list-page">
      {/* Header with back button and title */}
      <div className="sessions-header">
        <button
          className="back-button"
          onClick={() => navigate('/')}
          aria-label="Go back"
        >
          <BackIcon />
        </button>
        <h1>Sessions</h1>
      </div>

      {/* Search bar */}
      <div className="sessions-search-container">
        <SearchIcon />
        <input
          type="text"
          className="sessions-search-input"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search sessions"
        />
        {searchQuery && (
          <button
            className="search-clear-button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="sessions-content">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refresh} />
        ) : groupedSessions.length === 0 ? (
          <EmptyState searchQuery={searchQuery} onStartRecording={handleStartRecording} />
        ) : (
          <div className="sessions-list">
            {groupedSessions.map((group) => (
              <div key={group.month} className="sessions-month-group">
                <h2 className="sessions-month-title">{group.month}</h2>
                <div className="sessions-month-items">
                  {group.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onClick={() => handleSessionClick(session.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
