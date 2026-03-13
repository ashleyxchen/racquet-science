/**
 * Device Connection Page
 *
 * Provides manual control for connecting to Watch and Arduino/Racket devices.
 * Useful for troubleshooting BLE connections before starting a recording.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { useArduinoBle } from '../hooks/useArduinoBle';
import { ArduinoDevice, ARDUINO_BLE_SERVICE_UUID } from '../types/arduino';

// Watch Motion plugin interface
interface WatchMotionPlugin {
  isWatchConnected(): Promise<{ connected: boolean }>;
}

const WatchMotion = registerPlugin<WatchMotionPlugin>('WatchMotion');

// Icons
function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function WatchIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="2" width="12" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="5" width="8" height="10" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function RacketIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="8" rx="6" ry="7" />
      <line x1="12" y1="15" x2="12" y2="22" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="12" y1="4" x2="12" y2="12" />
    </svg>
  );
}

function BluetoothIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L17 7L12 12L17 17L12 22V12L7 17L8.41 18.41L12 14.83V22L7 17L12 12L7 7L12 2M12 9.17L14.59 6.58L12 4V9.17Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function DeviceConnectionPage() {
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();

  // Watch state
  const [watchConnected, setWatchConnected] = useState(false);
  const [watchChecking, setWatchChecking] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);

  // Arduino BLE hook
  const {
    connectionStatus,
    isScanning,
    isConnected,
    isStreaming,
    discoveredDevices,
    scan,
    stopScan,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    latestSample,
    latestFSRFrame,
  } = useArduinoBle();

  // Debug: scan all devices
  const [allDevices, setAllDevices] = useState<ArduinoDevice[]>([]);
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const scanAllTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check Watch connection on mount
  useEffect(() => {
    checkWatchConnection();
  }, []);

  const checkWatchConnection = async () => {
    if (!isNative) {
      setWatchConnected(true); // Simulate for web
      return;
    }

    setWatchChecking(true);
    setWatchError(null);

    try {
      const result = await WatchMotion.isWatchConnected();
      setWatchConnected(result.connected);
    } catch (err) {
      setWatchError(err instanceof Error ? err.message : 'Failed to check Watch');
      setWatchConnected(false);
    } finally {
      setWatchChecking(false);
    }
  };

  const handleScanForArduino = async () => {
    try {
      await scan(10000); // 10 second scan
    } catch (err) {
      console.error('Scan failed:', err);
    }
  };

  // Debug: Scan for ALL BLE devices (no filters)
  const handleScanAllDevices = async () => {
    if (!isNative) {
      setAllDevices([{ deviceId: 'sim-1', name: 'Simulated Device 1' }]);
      return;
    }

    setIsScanningAll(true);
    setAllDevices([]);

    try {
      await BleClient.initialize({ androidNeverForLocation: true });

      console.log('DEBUG: Starting unfiltered BLE scan...');
      await BleClient.requestLEScan(
        {}, // No filters - find ALL devices
        (result: ScanResult) => {
          console.log('DEBUG: Found device:', result.device.name || '(no name)', result.device.deviceId);
          setAllDevices(prev => {
            const exists = prev.some(d => d.deviceId === result.device.deviceId);
            if (exists) return prev;
            return [...prev, {
              deviceId: result.device.deviceId,
              name: result.device.name || null,
              rssi: result.rssi,
            }];
          });
        }
      );

      // Stop after 10 seconds
      scanAllTimeoutRef.current = setTimeout(async () => {
        await BleClient.stopLEScan();
        setIsScanningAll(false);
        console.log('DEBUG: Scan complete');
      }, 10000);
    } catch (err) {
      console.error('DEBUG: Scan all failed:', err);
      setIsScanningAll(false);
    }
  };

  const handleStopScanAll = async () => {
    if (scanAllTimeoutRef.current) {
      clearTimeout(scanAllTimeoutRef.current);
    }
    try {
      await BleClient.stopLEScan();
    } catch (err) {
      console.error('Error stopping scan:', err);
    }
    setIsScanningAll(false);
  };

  const handleConnectArduino = async (device: ArduinoDevice) => {
    try {
      await connect(device.deviceId);
    } catch (err) {
      console.error('Connect failed:', err);
    }
  };

  const handleDisconnectArduino = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  const handleToggleStreaming = async () => {
    try {
      if (isStreaming) {
        await stopStreaming();
      } else {
        await startStreaming();
      }
    } catch (err) {
      console.error('Streaming toggle failed:', err);
    }
  };

  const getConnectionStatusColor = (connected: boolean, error?: string | null) => {
    if (error) return '#f44336';
    if (connected) return '#0A6C3B';
    return '#9e9e9e';
  };

  const getArduinoStatusText = () => {
    switch (connectionStatus.state) {
      case 'scanning':
        return 'Scanning...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'streaming':
        return 'Streaming';
      case 'error':
        return connectionStatus.error || 'Error';
      default:
        return 'Disconnected';
    }
  };

  // Convert FSR value (0-1023) to heatmap color
  const getFSRColor = (value: number): string => {
    // Normalize to 0-1
    const normalized = Math.min(1, Math.max(0, value / 1023));

    if (normalized < 0.1) {
      // No pressure - dark gray
      return '#2a2a2a';
    } else if (normalized < 0.3) {
      // Low pressure - blue
      const intensity = (normalized - 0.1) / 0.2;
      return `rgb(${Math.floor(intensity * 50)}, ${Math.floor(intensity * 100)}, ${Math.floor(150 + intensity * 105)})`;
    } else if (normalized < 0.5) {
      // Medium-low - cyan to green
      const intensity = (normalized - 0.3) / 0.2;
      return `rgb(0, ${Math.floor(150 + intensity * 105)}, ${Math.floor(255 - intensity * 155)})`;
    } else if (normalized < 0.7) {
      // Medium - green to yellow
      const intensity = (normalized - 0.5) / 0.2;
      return `rgb(${Math.floor(intensity * 255)}, 255, ${Math.floor(100 - intensity * 100)})`;
    } else if (normalized < 0.85) {
      // High - yellow to orange
      const intensity = (normalized - 0.7) / 0.15;
      return `rgb(255, ${Math.floor(255 - intensity * 130)}, 0)`;
    } else {
      // Very high - orange to red
      const intensity = (normalized - 0.85) / 0.15;
      return `rgb(255, ${Math.floor(125 - intensity * 125)}, 0)`;
    }
  };

  return (
    <div style={{ padding: '20px', paddingTop: '60px', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            marginRight: '12px',
          }}
        >
          <BackIcon />
        </button>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Device Connections</h1>
      </div>

      {/* Watch Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#e3f2fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
          }}>
            <WatchIcon />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>Apple Watch</h3>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: getConnectionStatusColor(watchConnected, watchError),
            }}>
              {watchChecking ? 'Checking...' : watchError ? watchError : watchConnected ? 'Connected' : 'Not Connected'}
            </p>
          </div>
          <button
            onClick={checkWatchConnection}
            disabled={watchChecking}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '8px',
              cursor: watchChecking ? 'not-allowed' : 'pointer',
              opacity: watchChecking ? 0.5 : 1,
            }}
          >
            <RefreshIcon />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
          Make sure the Watch app is installed and running. The Watch connects automatically via Watch Connectivity when in range.
        </p>
      </div>

      {/* Arduino/Racket Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#fff3e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
          }}>
            <RacketIcon />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>Racket Sensor</h3>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: getConnectionStatusColor(isConnected, connectionStatus.error),
            }}>
              {connectionStatus.device?.name || getArduinoStatusText()}
            </p>
          </div>
          {isConnected && (
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isStreaming ? '#0A6C3B' : '#ff9800',
              animation: isStreaming ? 'pulse 1s infinite' : 'none',
            }} />
          )}
        </div>

        {/* Connection Error */}
        {connectionStatus.error && (
          <div style={{
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#c62828',
          }}>
            {connectionStatus.error}
          </div>
        )}

        {/* Scan / Connect / Disconnect Buttons */}
        {!isConnected ? (
          <div>
            <button
              onClick={isScanning ? stopScan : handleScanForArduino}
              disabled={connectionStatus.state === 'connecting'}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: isScanning ? '#ff9800' : '#0A6C3B',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <BluetoothIcon />
              {isScanning ? 'Stop Scanning' : 'Scan for RacquetSense'}
            </button>

            {/* Discovered Devices */}
            {discoveredDevices.length > 0 && (
              <div>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', color: '#666' }}>
                  Found Devices:
                </p>
                {discoveredDevices.map((device) => (
                  <div
                    key={device.deviceId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <p style={{ margin: '0 0 2px 0', fontWeight: '500' }}>
                        {device.name || 'Unknown Device'}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                        {device.rssi ? `Signal: ${device.rssi} dBm` : device.deviceId.substring(0, 17)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleConnectArduino(device)}
                      disabled={connectionStatus.state === 'connecting'}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#0A6C3B',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isScanning && discoveredDevices.length === 0 && (
              <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                Searching for devices...
              </p>
            )}
          </div>
        ) : (
          <div>
            {/* Connected Device Info */}
            <div style={{
              backgroundColor: '#e8f5e9',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
            }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '500', color: '#2e7d32' }}>
                Connected to {connectionStatus.device?.name}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                IMU packets: {connectionStatus.imuPacketCount} | FSR frames: {connectionStatus.fsrFrameCount}
              </p>
            </div>

            {/* Streaming Controls */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleToggleStreaming}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: isStreaming ? '#ff9800' : '#0A6C3B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
              </button>
              <button
                onClick={handleDisconnectArduino}
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            </div>

            {/* Live Data Display */}
            {isStreaming && latestSample && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Live IMU Data:</p>
                <p style={{ margin: '2px 0' }}>
                  Accel: X={latestSample.accel.x.toFixed(3)}g, Y={latestSample.accel.y.toFixed(3)}g, Z={latestSample.accel.z.toFixed(3)}g
                </p>
                <p style={{ margin: '2px 0' }}>
                  Gyro: X={latestSample.gyro.x.toFixed(1)}dps, Y={latestSample.gyro.y.toFixed(1)}dps, Z={latestSample.gyro.z.toFixed(1)}dps
                </p>
                <p style={{ margin: '2px 0', color: '#666' }}>
                  Seq: {latestSample.sequence} | Time: {latestSample.timestamp}ms
                </p>
              </div>
            )}

            {/* Live FSR Grid Display */}
            {isStreaming && latestFSRFrame && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#1a1a1a',
                borderRadius: '8px',
              }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', color: 'white', fontSize: '14px' }}>
                  Live FSR Grid (4×8):
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '4px',
                  marginBottom: '12px',
                }}>
                  {latestFSRFrame.grid.map((row, rowIdx) =>
                    row.map((value, colIdx) => (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        style={{
                          aspectRatio: '1',
                          backgroundColor: getFSRColor(value),
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          color: value > 400 ? '#000' : '#888',
                          fontFamily: 'monospace',
                          minHeight: '28px',
                        }}
                      >
                        {value}
                      </div>
                    ))
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
                    Frame: {latestFSRFrame.frameSequence}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#666' }}>Low</span>
                    <div style={{
                      display: 'flex',
                      height: '12px',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((val, i) => (
                        <div
                          key={i}
                          style={{
                            width: '16px',
                            backgroundColor: getFSRColor(val * 1023),
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: '10px', color: '#666' }}>High</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
          The racket sensor connects via Bluetooth LE. Make sure the Arduino is powered on and advertising as "RacquetSense".
        </p> */}
      </div>

      {/* Troubleshooting Tips */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '16px',
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Troubleshooting Notes</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#666', lineHeight: 1.8 }}>
          <li>ensure Bluetooth is enabled on your iPhone</li>
          <li>Arduino serial monitor should show "Waiting for connection..." if not connected already</li>
          <li>only one device can connect to the Arduino at a time</li>
          <li>try resetting the Arduino</li>
          <li>app must run on a physical device (not simulator)</li>
        </ul>
      </div>

      {/* Debug Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setShowDebug(!showDebug)}
        >
          <h3 style={{ margin: 0, fontSize: '16px' }}>Debug Tools</h3>
          <span style={{ fontSize: '20px' }}>{showDebug ? '−' : '+'}</span>
        </div>

        {showDebug && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>
              Scan for ALL nearby BLE devices (no name/service filters):
            </p>

            <button
              onClick={isScanningAll ? handleStopScanAll : handleScanAllDevices}
              disabled={isScanning}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: isScanningAll ? '#ff9800' : '#0A6C3B',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                marginBottom: '12px',
              }}
            >
              {isScanningAll ? 'Stop Scanning All' : 'Scan All BLE Devices'}
            </button>

            {allDevices.length > 0 && (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '500' }}>
                  Found {allDevices.length} devices:
                </p>
                {allDevices.map((device, idx) => (
                  <div
                    key={device.deviceId}
                    style={{
                      padding: '10px',
                      backgroundColor: device.name?.includes('Racquet') || device.name?.includes('Arduino') ? '#e8f5e9' : '#f5f5f5',
                      borderRadius: '6px',
                      marginBottom: '6px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  >
                    <div style={{ fontWeight: '500' }}>
                      {idx + 1}. {device.name || '(no name)'}
                    </div>
                    <div style={{ color: '#666', marginTop: '2px' }}>
                      ID: {device.deviceId}
                    </div>
                    {device.rssi && (
                      <div style={{ color: '#666' }}>
                        RSSI: {device.rssi} dBm
                      </div>
                    )}
                    <button
                      onClick={() => handleConnectArduino(device)}
                      style={{
                        marginTop: '6px',
                        padding: '4px 12px',
                        backgroundColor: '#0A6C3B',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Try Connect
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isScanningAll && allDevices.length === 0 && (
              <p style={{ textAlign: 'center', color: '#666', fontSize: '13px' }}>
                Scanning for all devices...
              </p>
            )}

            <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#fff3e0', borderRadius: '6px', fontSize: '12px' }}>
              <strong>Expected:</strong> Look for a device named "RacquetSense" in the list above.
              If it appears with a different name, or no name, you can try connecting to it directly.
            </div>
          </div>
        )}
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default DeviceConnectionPage;
