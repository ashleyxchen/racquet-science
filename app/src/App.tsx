import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import HomePage from './pages/HomePage';
import ConnectionTestPage from './pages/ConnectionTestPage';
import DeviceConnectionPage from './pages/DeviceConnectionPage';
import RecordingPage from './pages/RecordingPage';
import RecordingWizardPage from './pages/RecordingWizardPage';
import SessionListPage from './pages/SessionListPage';
import SessionDetailPage from './pages/SessionDetailPage';
import SessionSummaryPage from './pages/SessionSummaryPage';
import MultiSessionAnalyticsPage from './pages/MultiSessionAnalyticsPage';
import SwipeableRoutes from './components/SwipeableRoutes';

// Register WatchMotion plugin for early loading
interface WatchMotionPlugin {
  ping(): Promise<{ status: string }>;
}
const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

function App() {
  const location = useLocation();

  useEffect(() => {
    SplashScreen.hide();

    // Force WatchMotion plugin to load early on native platforms
    if (Capacitor.isNativePlatform()) {
      WatchMotion.ping().catch(() => {});
    }
  }, []);

  return (
    <SwipeableRoutes>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/connection-test" element={<ConnectionTestPage />} />
        <Route path="/devices" element={<DeviceConnectionPage />} />
        <Route path="/record" element={<RecordingPage />} />
        <Route path="/record-wizard" element={<RecordingWizardPage />} />
        <Route path="/sessions" element={<SessionListPage />} />
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
        <Route path="/session-summary" element={<SessionSummaryPage />} />
        <Route path="/analytics" element={<MultiSessionAnalyticsPage />} />
      </Routes>
    </SwipeableRoutes>
  );
}

export default App;
