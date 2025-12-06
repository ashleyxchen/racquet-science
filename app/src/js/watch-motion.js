import { registerPlugin } from '@capacitor/core';

const WatchMotion = registerPlugin('WatchMotion');

// Store latest motion data
let latestWatchData = null;

// Listen for real-time motion data from Watch
export function startWatchMotionListener(callback) {
  if (!WatchMotion) {
    console.error('WatchMotion plugin not available');
    return;
  }

  // Add listener for motion data events
  WatchMotion.addListener('motionData', (data) => {
    console.log('📊 Watch motion data received:', data);
    latestWatchData = data;

    // Call the callback with the new data
    if (callback) {
      callback(data);
    }
  });

  console.log('✅ Watch motion listener started');
}

// Check if Watch is connected
export async function isWatchConnected() {
  if (!WatchMotion) {
    return false;
  }

  try {
    const result = await WatchMotion.isWatchConnected();
    return result.connected;
  } catch (error) {
    console.error('Error checking Watch connection:', error);
    return false;
  }
}

// Get latest motion data (one-time fetch)
export async function getWatchMotionData() {
  if (!WatchMotion) {
    return null;
  }

  try {
    const data = await WatchMotion.getMotionData();
    return data;
  } catch (error) {
    console.error('Error getting Watch motion data:', error);
    return null;
  }
}

// Get latest cached data
export function getLatestWatchData() {
  return latestWatchData;
}

// Helper to format motion data for display
export function formatMotionData(data) {
  if (!data || !data.accel || !data.gyro || !data.orientation) {
    return {
      accel: { x: 0, y: 0, z: 0 },
      gyro: { x: 0, y: 0, z: 0 },
      orientation: { roll: 0, pitch: 0, yaw: 0 }
    };
  }

  return {
    accel: {
      x: data.accel.x.toFixed(3),
      y: data.accel.y.toFixed(3),
      z: data.accel.z.toFixed(3)
    },
    gyro: {
      x: data.gyro.x.toFixed(3),
      y: data.gyro.y.toFixed(3),
      z: data.gyro.z.toFixed(3)
    },
    orientation: {
      roll: (data.orientation.roll * 180 / Math.PI).toFixed(1),  // Convert to degrees
      pitch: (data.orientation.pitch * 180 / Math.PI).toFixed(1),
      yaw: (data.orientation.yaw * 180 / Math.PI).toFixed(1)
    }
  };
}
