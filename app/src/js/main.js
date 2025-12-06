import { BleClient } from '@capacitor-community/bluetooth-le';
import { SplashScreen } from '@capacitor/splash-screen';
import { startWatchMotionListener, isWatchConnected, formatMotionData } from './watch-motion.js';

// Hide splash screen when app loads
window.addEventListener('DOMContentLoaded', async () => {
  await SplashScreen.hide();

  // Initialize Watch motion listener
  initializeWatchMotion();
});

// Initialize Watch Motion Tracking
async function initializeWatchMotion() {
  // Check Watch connection status
  const connected = await isWatchConnected();
  updateWatchConnectionStatus(connected);

  // Start listening for motion data
  startWatchMotionListener((data) => {
    updateWatchMotionUI(data);
  });

  console.log('✅ Watch motion tracking initialized');
}

// Update Watch connection status in UI
function updateWatchConnectionStatus(connected) {
  const statusElement = document.getElementById('watch-connection-status');
  if (statusElement) {
    statusElement.textContent = connected ? 'Connected' : 'Disconnected';
    statusElement.className = connected ? 'connected' : '';
  }
}

// Update Watch motion data in UI (real-time)
function updateWatchMotionUI(data) {
  const formatted = formatMotionData(data);

  // Update accelerometer
  document.getElementById('watch-accel-x').textContent = formatted.accel.x;
  document.getElementById('watch-accel-y').textContent = formatted.accel.y;
  document.getElementById('watch-accel-z').textContent = formatted.accel.z;

  // Update gyroscope
  document.getElementById('watch-gyro-x').textContent = formatted.gyro.x;
  document.getElementById('watch-gyro-y').textContent = formatted.gyro.y;
  document.getElementById('watch-gyro-z').textContent = formatted.gyro.z;

  // Update orientation
  document.getElementById('watch-roll').textContent = formatted.orientation.roll + '°';
  document.getElementById('watch-pitch').textContent = formatted.orientation.pitch + '°';
  document.getElementById('watch-yaw').textContent = formatted.orientation.yaw + '°';

  // Update connection status when data is received
  updateWatchConnectionStatus(true);
}

export async function scan() {
  try {
    await BleClient.initialize();
    await BleClient.initialize({ androidNeverForLocation: true });
    await BleClient.requestLEScan(
      {
        //services: [HEART_RATE_SERVICE],
      },
      (result) => {
        console.log('received new scan result', result);
      }
    );

    setTimeout(async () => {
      await BleClient.stopLEScan();
      console.log('stopped scanning');
    }, 5000);
  } catch (error) {
    console.error(error);
  }
}

let deviceObject;
export async function connect() {
  try {
    await BleClient.initialize();

    const device = await BleClient.requestDevice({});

    // connect to device, the onDisconnect callback is optional
    await BleClient.connect(device.deviceId, (deviceId) => onDisconnect(deviceId));
    console.log('connected to device', device);
    deviceObject = device;
  } catch (error) {
    console.error(error);
  }
}

const char1Value = document.getElementById('char1');
async function startListen() {
  await BleClient.startNotifications(
    deviceObject.deviceId,
    '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    (value) => {
      console.log('char data received: ', value.getUint32(0), true);
      char1Value.innerHTML = value.getUint32(0, true).toString();
    }
  );
}

function onDisconnect(deviceId) {
  console.log(`device ${deviceId} disconnected`);
}

const button1 = document.getElementById('button1');
button1.addEventListener('click', () => {
  connect();
  console.log('button pressed');
});

const button2 = document.getElementById('button2');
button2.addEventListener('click', () => {
  startListen();
});
