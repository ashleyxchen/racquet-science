/**
 * Session Detail Page
 *
 * Shows detailed session information with three tabs:
 * 1. Full Session Analysis - complete sensor data visualization
 * 2. Session Summary - high-level metrics and statistics
 * 3. Zoom In - detailed view of specific time ranges
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useSessionDetail } from '../hooks/useSessionDetail';
import { FullSessionTab } from '../components/sessions/tabs/FullSessionTab';
import { SessionSummaryTab } from '../components/sessions/tabs/SessionSummaryTab';
import { ZoomInTab } from '../components/sessions/tabs/ZoomInTab';
import type { SessionTab } from '../types/sessionDetail';
import '../css/style.css';

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Tab button component
 */
function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      className={`session-tab-button ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/**
 * Session Detail Page Component
 */
export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SessionTab>('full-session');

  const sessionId = parseInt(id || '0', 10);
  const { session, sensorData, videoUrl, isLoading, error } = useSessionDetail(sessionId);

  // Handle back navigation
  const handleBack = () => {
    navigate('/sessions');
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="session-detail-page">
        <div className="session-detail-header">
          <button className="back-button" onClick={handleBack}>
            ← Back
          </button>
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || !session) {
    return (
      <div className="session-detail-page">
        <div className="session-detail-header">
          <button className="back-button" onClick={handleBack}>
            ← Back
          </button>
          <h1>Error</h1>
        </div>
        <div className="error-message">
          {error || 'Session not found'}
        </div>
      </div>
    );
  }

  // Generate session name (use date if no custom name)
  const sessionName = session.session_metadata?.name
    ? String(session.session_metadata.name)
    : new Date(session.started_at || session.created_at).toLocaleDateString();

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'full-session':
        return (
          <FullSessionTab
            session={session}
            sensorData={sensorData}
            videoUrl={videoUrl}
          />
        );

      case 'summary':
        return (
          <SessionSummaryTab
            session={session}
            sensorData={sensorData}
          />
        );

      case 'zoom-in':
        return (
          <ZoomInTab
            session={session}
            sensorData={sensorData}
            videoUrl={videoUrl}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="session-detail-page">
      {/* Header */}
      <div className="session-detail-header">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        <h1>{sessionName}</h1>
      </div>

      {/* Tab Navigation */}
      <div className="session-tabs-container">
        <TabButton
          label="Full Session Analysis"
          active={activeTab === 'full-session'}
          onClick={() => setActiveTab('full-session')}
        />
        <TabButton
          label="Session Summary"
          active={activeTab === 'summary'}
          onClick={() => setActiveTab('summary')}
        />
        <TabButton
          label="Zoom In"
          active={activeTab === 'zoom-in'}
          onClick={() => setActiveTab('zoom-in')}
        />
      </div>

      {/* Tab Content */}
      <div className="session-tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}
