import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import HomePage from './pages/HomePage';
import ConnectionTestPage from './pages/ConnectionTestPage';
import RecordingPage from './pages/RecordingPage';
import SessionListPage from './pages/SessionListPage';
import SessionPlaybackPage from './pages/SessionPlaybackPage';

// Register WatchMotion plugin for early loading
interface WatchMotionPlugin {
  ping(): Promise<{ status: string }>;
}
const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

function App() {
  useEffect(() => {
    SplashScreen.hide();

    // Force WatchMotion plugin to load early on native platforms
    if (Capacitor.isNativePlatform()) {
      WatchMotion.ping().catch(() => {});
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/connection-test" element={<ConnectionTestPage />} />
      <Route path="/record" element={<RecordingPage />} />
      <Route path="/sessions" element={<SessionListPage />} />
      <Route path="/sessions/:id" element={<SessionPlaybackPage />} />
    </Routes>
  );
}

export default App;
