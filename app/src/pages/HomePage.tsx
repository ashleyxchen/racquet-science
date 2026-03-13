import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Local asset imports
import profileImage from '../assets/imgs/profile-placeholder.jpg';
import sessionImage from '../assets/imgs/session-workout.jpg';
import racketIcon from '../assets/imgs/racket-icon.png';

// Watch plugin
interface WatchMotionPlugin {
  isWatchConnected(): Promise<{ connected: boolean }>;
}
const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

// Icons as SVG components
function ArrowRightIcon() {
  return (
    <svg className="record-button-arrow" viewBox="0 0 24 24" fill="none">
      <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FireIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23C16.1421 23 19.5 19.6421 19.5 15.5C19.5 13.1716 18.5 10.5 17 8.5C17 10 16 11.5 14.5 12C14.8 10 14.5 7 12 4C11.5 6.5 10.5 8 8.5 9.5C6.5 11 4.5 13.1716 4.5 15.5C4.5 19.6421 7.85786 23 12 23Z"/>
      <path d="M12 23C14.2091 23 16 21.2091 16 19C16 17.5 15.5 16 14.5 15C14.5 16 14 17 13 17.5C13.2 16.5 13 15 12 13.5C11.7 14.8 11.2 15.5 10.2 16.25C9.2 17 8 17.5 8 19C8 21.2091 9.79086 23 12 23Z" fill="white"/>
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"/>
    </svg>
  );
}

function WatchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C9.79 2 7.67 2.78 6 4.16V3C6 2.45 5.55 2 5 2C4.45 2 4 2.45 4 3V6C4 6.55 4.45 7 5 7H8C8.55 7 9 6.55 9 6C9 5.45 8.55 5 8 5H6.84C8.15 3.92 9.72 3.22 11.44 3.05C11.63 3.02 11.81 3 12 3C15.31 3 18 5.69 18 9V15C18 18.31 15.31 21 12 21C8.69 21 6 18.31 6 15V14C6 13.45 5.55 13 5 13C4.45 13 4 13.45 4 14V15C4 19.41 7.59 23 12 23C16.41 23 20 19.41 20 15V9C20 4.59 16.41 1 12 1C11.66 1 11.33 1.02 11 1.05V1H12V2Z"/>
      <rect x="9" y="8" width="6" height="8" rx="1"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A6C3B">
      <path d="M8 5V19L19 12L8 5Z"/>
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 3V21H21V3H3ZM19 19H5V5H19V19Z"/>
      <path d="M7 17V10H9V17H7Z"/>
      <path d="M11 17V7H13V17H11Z"/>
      <path d="M15 17V13H17V17H15Z"/>
    </svg>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();

  // Device connection state
  const [watchConnected, setWatchConnected] = useState<boolean | null>(null);
  const [racketConnected, setRacketConnected] = useState(false);

  // Check Watch connection on mount
  useEffect(() => {
    const checkWatch = async () => {
      if (!isNative) {
        setWatchConnected(true); // Simulate for web
        return;
      }
      try {
        const result = await WatchMotion.isWatchConnected();
        setWatchConnected(result.connected);
      } catch {
        setWatchConnected(false);
      }
    };

    checkWatch();
    // Re-check every 5 seconds
    const interval = setInterval(checkWatch, 5000);
    return () => clearInterval(interval);
  }, [isNative]);

  // Get current date formatted
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getStatusText = (connected: boolean | null) => {
    if (connected === null) return 'Checking...';
    return connected ? 'Connected' : 'Not Connected';
  };

  const getStatusColor = (connected: boolean | null) => {
    if (connected === null) return '#999';
    return connected ? '#0A6C3B' : '#f44336';
  };

  return (
    <div className="landing-page">
      {/* Header Section */}
      <div className="landing-header">
        <div className="landing-header-content">
          <img
            src={profileImage}
            alt="Profile"
            className="profile-image"
          />
          <div className="profile-info">
            <p className="profile-date">{currentDate}</p>
            <p className="profile-greeting">Hello, Ashley</p>
            <p className="profile-handedness">Right-Handed</p>
          </div>
        </div>

        <button className="record-button" onClick={() => navigate('/record-wizard')}>
          <span className="record-button-text">Record New Session</span>
          <ArrowRightIcon />
        </button>
      </div>

      {/* Browse Metrics Section
      <div className="section-header">
        <span className="section-title">Browse Metrics</span>
        <button className="section-see-all">See All</button>
      </div>

      <div className="metrics-chips">
        <button className="metric-chip active">
          <FireIcon className="metric-chip-icon" />
          <span className="metric-chip-text">Grip Force</span>
        </button>
        <button className="metric-chip">
          <HeartIcon className="metric-chip-icon" />
          <span className="metric-chip-text">Forehand</span>
        </button>
        <button className="metric-chip">
          <HeartIcon className="metric-chip-icon" />
          <span className="metric-chip-text">Backhand</span>
        </button>
      </div> */}

      {/* Analytics Section */}
      <div className="section-header">
        <span className="section-title">Analytics</span>
      </div>

      <div className="analytics-card" onClick={() => navigate('/analytics')}>
        <div className="analytics-card-icon">
          <ChartIcon />
        </div>
        <div className="analytics-card-content">
          <h3 className="analytics-card-title">Performance Trends</h3>
          <p className="analytics-card-description">
            View grip force, acceleration, and efficiency across sessions
          </p>
        </div>
        <div className="analytics-card-arrow">
          <ArrowRightIcon />
        </div>
      </div>

      {/* Sessions Section */}
      <div className="section-header">
        <span className="section-title">Sessions</span>
        <button className="section-see-all" onClick={() => navigate('/sessions')}>See All</button>
      </div>

      {/* <div className="session-card" onClick={() => navigate('/sessions')}>
        <img
          src={sessionImage}
          alt="Session"
          className="session-card-image"
        />
        <span className="session-card-duration">25min</span>
        <div className="session-card-overlay">
          <span className="session-card-title">Afternoon Sesh</span>
        </div>
        <button className="session-card-play">
          <PlayIcon />
        </button>
      </div> */}

      {/* Devices Section */}
      <div className="section-header">
        <span className="section-title">Devices</span>
        <button className="section-see-all" onClick={() => navigate('/devices')}>Manage</button>
      </div>

      <div className="devices-list" onClick={() => navigate('/devices')} style={{ cursor: 'pointer' }}>
        <div className="device-card">
          <div className="device-icon-wrapper">
            <img src={racketIcon} alt="Racket" className="device-icon" />
          </div>
          <div className="device-info">
            <p className="device-name">RacquetSense</p>
            <p className="device-status" style={{ color: getStatusColor(racketConnected) }}>
              Racket - {getStatusText(racketConnected)}
            </p>
          </div>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(racketConnected),
            marginLeft: 'auto',
          }} />
        </div>

        <div className="device-card">
          <div className="device-icon-wrapper">
            <WatchIcon className="device-watch-icon" />
          </div>
          <div className="device-info">
            <p className="device-name">Ashley's Apple Watch</p>
            <p className="device-status" style={{ color: getStatusColor(watchConnected) }}>
              Watch - {getStatusText(watchConnected)}
            </p>
          </div>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(watchConnected),
            marginLeft: 'auto',
          }} />
        </div>
      </div>

      {/* Device Management Button */}
      <button className="connection-test-button" onClick={() => navigate('/devices')}>
        <span className="connection-test-text">Connect Devices</span>
      </button>
    </div>
  );
}

export default HomePage;
