import { type SessionResponse } from '../../services/api/sessions';
import { format, parseISO } from 'date-fns';

interface SessionCardProps {
  session: SessionResponse;
  onClick: () => void;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  // Get session name from metadata or fallback
  const sessionName = session.session_metadata?.name as string || `Session #${session.id}`;

  // Format date from started_at
  const dateStr = session.started_at
    ? format(parseISO(session.started_at), 'MMM d, yyyy • h:mm a')
    : 'Unknown date';

  // Format duration in minutes
  const durationMin = session.duration
    ? Math.round(session.duration / 60)
    : null;

  return (
    <div className="session-card-item" onClick={onClick}>
      <div className="session-card-info">
        <span className="session-card-name">{sessionName}</span>
        <span className="session-card-date">{dateStr}</span>
      </div>
      {durationMin && (
        <span className="session-card-duration-badge">{durationMin}min</span>
      )}
    </div>
  );
}
