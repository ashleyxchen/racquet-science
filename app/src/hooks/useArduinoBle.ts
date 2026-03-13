/**
 * React hook for Arduino Nano 33 BLE Sense Rev2 sensor data streaming
 *
 * Provides BLE connection management and real-time IMU + FSR data streaming
 * from the Arduino device to the React app via Capacitor BLE plugin.
 *
 * Supports:
 * - IMU data (accelerometer + gyroscope) @ 100Hz
 * - FSR pressure grid (4x8 = 32 sensors) @ 20Hz
 *
 * Usage:
 * ```tsx
 * const {
 *   connectionStatus,
 *   isConnected,
 *   isStreaming,
 *   discoveredDevices,
 *   scan,
 *   connect,
 *   disconnect,
 *   startStreaming,
 *   stopStreaming,
 *   latestIMUSample,
 *   latestFSRFrame,
 *   onIMUSample,
 *   onFSRFrame,
 * } = useArduinoBle();
 *
 * // Start streaming both IMU and FSR
 * await startStreaming({ imu: true, fsr: true });
 *
 * // Subscribe to IMU samples
 * const unsubscribe = onIMUSample((sample) => {
 *   console.log('IMU:', sample.accel, sample.gyro);
 * });
 *
 * // Subscribe to FSR frames
 * onFSRFrame((frame) => {
 *   console.log('FSR grid:', frame.grid);
 * });
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import {
  ArduinoConnectionStatus,
  ArduinoDevice,
  ArduinoIMUSample,
  ArduinoFSRFrame,
  ArduinoSensorConfig,
  ArduinoIMUConfig,
  UseArduinoBleResult,
  ArduinoCommand,
  PacketType,
  ARDUINO_BLE_SERVICE_UUID,
  ARDUINO_SENSOR_DATA_CHAR_UUID,
  ARDUINO_CONTROL_CHAR_UUID,
  ARDUINO_CONFIG_CHAR_UUID,
  ARDUINO_DEVICE_NAME,
  FSR_ROWS,
  FSR_COLS,
} from '../types/arduino';
import {
  getPacketType,
  parseIMUPacket,
  parseFSRChunk,
  FSRFrameAssembler,
  isStatusResponse,
  parseStatusResponse,
  parseSensorConfig,
  encodeSensorConfig,
  encodeCommand,
} from '../services/arduinoParser';

// Default scan timeout in milliseconds
const DEFAULT_SCAN_TIMEOUT = 5000;

export function useArduinoBle(): UseArduinoBleResult {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ArduinoConnectionStatus>({
    state: 'disconnected',
    device: null,
    error: null,
    imuPacketCount: 0,
    fsrFrameCount: 0,
    imuPacketLossRate: 0,
    lastImuSequence: 0,
    lastFsrSequence: 0,
    // Legacy aliases
    packetCount: 0,
    packetLossRate: 0,
    lastSequence: 0,
  });

  // Discovered devices
  const [discoveredDevices, setDiscoveredDevices] = useState<ArduinoDevice[]>([]);

  // Configuration
  const [config, setConfigState] = useState<ArduinoSensorConfig | null>(null);

  // Latest samples
  const [latestIMUSample, setLatestIMUSample] = useState<ArduinoIMUSample | null>(null);
  const [latestFSRFrame, setLatestFSRFrame] = useState<ArduinoFSRFrame | null>(null);

  // Refs for non-reactive state
  const connectedDeviceRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const imuCallbacksRef = useRef<Set<(sample: ArduinoIMUSample) => void>>(new Set());
  const fsrCallbacksRef = useRef<Set<(frame: ArduinoFSRFrame) => void>>(new Set());
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imuSequenceHistoryRef = useRef<number[]>([]);
  const fsrAssemblerRef = useRef<FSRFrameAssembler>(new FSRFrameAssembler());

  // Throttling for state updates - batch updates to reduce re-renders
  const pendingImuCountRef = useRef(0);
  const pendingFsrCountRef = useRef(0);
  const stateUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Computed state
  const isScanning = connectionStatus.state === 'scanning';
  const isConnected = connectionStatus.state === 'connected' || connectionStatus.state === 'streaming';
  const isStreaming = connectionStatus.state === 'streaming';
  const isNative = Capacitor.isNativePlatform();

  /**
   * Initialize BLE client
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    if (isInitializedRef.current) return true;

    if (!isNative) {
      console.log('BLE: Running in web mode - BLE not available');
      return false;
    }

    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      isInitializedRef.current = true;
      console.log('BLE: Initialized successfully');
      return true;
    } catch (error) {
      console.error('BLE: Initialization failed:', error);
      setConnectionStatus(prev => ({
        ...prev,
        state: 'error',
        error: error instanceof Error ? error.message : 'BLE initialization failed',
      }));
      return false;
    }
  }, [isNative]);

  /**
   * Scan for Arduino devices
   */
  const scan = useCallback(async (timeout: number = DEFAULT_SCAN_TIMEOUT): Promise<void> => {
    if (!isNative) {
      console.log('BLE: Simulating scan in web mode');
      setConnectionStatus(prev => ({ ...prev, state: 'scanning' }));

      setTimeout(() => {
        setDiscoveredDevices([
          { deviceId: 'simulated-arduino-1', name: 'RacquetSense (Simulated)', rssi: -50 },
        ]);
        setConnectionStatus(prev => ({ ...prev, state: 'disconnected' }));
      }, 2000);
      return;
    }

    const initialized = await initialize();
    if (!initialized) return;

    setDiscoveredDevices([]);
    setConnectionStatus(prev => ({
      ...prev,
      state: 'scanning',
      error: null,
    }));

    try {
      console.log('BLE: Starting scan for devices with name prefix:', ARDUINO_DEVICE_NAME);

      await BleClient.requestLEScan(
        {
          namePrefix: ARDUINO_DEVICE_NAME,
        },
        (result: ScanResult) => {
          console.log('BLE: Found device:', result.device.name, result.device.deviceId);

          setDiscoveredDevices(prev => {
            const exists = prev.some(d => d.deviceId === result.device.deviceId);
            if (exists) return prev;

            return [
              ...prev,
              {
                deviceId: result.device.deviceId,
                name: result.device.name || null,
                rssi: result.rssi,
              },
            ];
          });
        }
      );

      scanTimeoutRef.current = setTimeout(async () => {
        await stopScan();
      }, timeout);
    } catch (error) {
      console.error('BLE: Scan failed:', error);
      setConnectionStatus(prev => ({
        ...prev,
        state: 'error',
        error: error instanceof Error ? error.message : 'Scan failed',
      }));
    }
  }, [isNative, initialize]);

  /**
   * Stop scanning
   */
  const stopScan = useCallback(async (): Promise<void> => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    if (!isNative || !isInitializedRef.current) {
      setConnectionStatus(prev => ({ ...prev, state: 'disconnected' }));
      return;
    }

    try {
      await BleClient.stopLEScan();
      console.log('BLE: Scan stopped');
    } catch (error) {
      console.error('BLE: Error stopping scan:', error);
    }

    setConnectionStatus(prev => ({
      ...prev,
      state: prev.state === 'scanning' ? 'disconnected' : prev.state,
    }));
  }, [isNative]);

  /**
   * Connect to device
   */
  const connect = useCallback(async (deviceId: string): Promise<void> => {
    if (!isNative) {
      console.log('BLE: Simulating connection in web mode');
      setConnectionStatus(prev => ({
        ...prev,
        state: 'connected',
        device: { deviceId, name: 'RacquetSense (Simulated)' },
      }));
      connectedDeviceRef.current = deviceId;
      return;
    }

    const initialized = await initialize();
    if (!initialized) return;

    await stopScan();

    setConnectionStatus(prev => ({
      ...prev,
      state: 'connecting',
      error: null,
    }));

    try {
      console.log('BLE: Connecting to', deviceId);

      await BleClient.connect(deviceId, (disconnectedDeviceId) => {
        console.log('BLE: Device disconnected:', disconnectedDeviceId);
        handleDisconnect();
      });

      const device = discoveredDevices.find(d => d.deviceId === deviceId);

      connectedDeviceRef.current = deviceId;
      setConnectionStatus(prev => ({
        ...prev,
        state: 'connected',
        device: device || { deviceId, name: null },
        imuPacketCount: 0,
        fsrFrameCount: 0,
        imuPacketLossRate: 0,
        lastImuSequence: 0,
        lastFsrSequence: 0,
        packetCount: 0,
        packetLossRate: 0,
        lastSequence: 0,
      }));

      await readConfig(deviceId);

      console.log('BLE: Connected successfully');
    } catch (error) {
      console.error('BLE: Connection failed:', error);
      setConnectionStatus(prev => ({
        ...prev,
        state: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [isNative, initialize, stopScan, discoveredDevices]);

  /**
   * Handle disconnection
   */
  const handleDisconnect = useCallback(() => {
    connectedDeviceRef.current = null;
    imuSequenceHistoryRef.current = [];
    fsrAssemblerRef.current.clear();
    setLatestIMUSample(null);
    setLatestFSRFrame(null);
    setConfigState(null);
    setConnectionStatus({
      state: 'disconnected',
      device: null,
      error: null,
      imuPacketCount: 0,
      fsrFrameCount: 0,
      imuPacketLossRate: 0,
      lastImuSequence: 0,
      lastFsrSequence: 0,
      packetCount: 0,
      packetLossRate: 0,
      lastSequence: 0,
    });
  }, []);

  /**
   * Disconnect from device
   */
  const disconnect = useCallback(async (): Promise<void> => {
    const deviceId = connectedDeviceRef.current;

    if (!isNative || !deviceId) {
      handleDisconnect();
      return;
    }

    try {
      if (connectionStatus.state === 'streaming') {
        await sendCommand(deviceId, ArduinoCommand.STOP_ALL);
      }

      await BleClient.disconnect(deviceId);
      console.log('BLE: Disconnected');
    } catch (error) {
      console.error('BLE: Disconnect error:', error);
    }

    handleDisconnect();
  }, [isNative, connectionStatus.state, handleDisconnect]);

  /**
   * Send control command
   */
  const sendCommand = useCallback(async (deviceId: string, command: ArduinoCommand): Promise<void> => {
    if (!isNative) {
      console.log('BLE: Simulating command', command);
      return;
    }

    try {
      const data = encodeCommand(command);
      await BleClient.write(deviceId, ARDUINO_BLE_SERVICE_UUID, ARDUINO_CONTROL_CHAR_UUID, data);
      console.log('BLE: Command sent:', command);
    } catch (error) {
      console.error('BLE: Error sending command:', error);
      throw error;
    }
  }, [isNative]);

  /**
   * Read configuration
   */
  const readConfig = useCallback(async (deviceId: string): Promise<void> => {
    if (!isNative) return;

    try {
      const result = await BleClient.read(deviceId, ARDUINO_BLE_SERVICE_UUID, ARDUINO_CONFIG_CHAR_UUID);
      const parsedConfig = parseSensorConfig(result);
      if (parsedConfig) {
        setConfigState(parsedConfig);
        console.log('BLE: Config read:', parsedConfig);
      }
    } catch (error) {
      console.error('BLE: Error reading config:', error);
    }
  }, [isNative]);

  /**
   * Handle incoming BLE notification
   */
  const handleNotification = useCallback((value: DataView) => {
    const packetType = getPacketType(value);

    // Debug: log raw packet info occasionally
    const firstByte = value.byteLength > 0 ? value.getUint8(0) : -1;
    if (Math.random() < 0.01) { // 1% of packets
      console.debug(`[BLE] Packet: size=${value.byteLength}, type=0x${firstByte.toString(16)}, packetType=${packetType}`);
    }

    // Handle status response
    if (isStatusResponse(value)) {
      const status = parseStatusResponse(value);
      console.log('BLE: Status response:', status);
      return;
    }

    // Handle IMU packet
    if (packetType === PacketType.IMU) {
      const sample = parseIMUPacket(value);
      if (!sample) return;

      // Track sequence for packet loss detection
      imuSequenceHistoryRef.current.push(sample.sequence);
      if (imuSequenceHistoryRef.current.length > 1000) {
        imuSequenceHistoryRef.current = imuSequenceHistoryRef.current.slice(-500);
      }

      // Notify callbacks immediately (for data collection)
      imuCallbacksRef.current.forEach(cb => cb(sample));

      // Throttle React state updates to avoid re-render storm
      // Update sample ref immediately, batch status updates every 100ms
      setLatestIMUSample(sample);
      pendingImuCountRef.current++;

      if (!stateUpdateTimeoutRef.current) {
        stateUpdateTimeoutRef.current = setTimeout(() => {
          setConnectionStatus(prev => ({
            ...prev,
            imuPacketCount: prev.imuPacketCount + pendingImuCountRef.current,
            fsrFrameCount: prev.fsrFrameCount + pendingFsrCountRef.current,
            lastImuSequence: imuSequenceHistoryRef.current[imuSequenceHistoryRef.current.length - 1] ?? prev.lastImuSequence,
            packetCount: prev.imuPacketCount + pendingImuCountRef.current,
            lastSequence: imuSequenceHistoryRef.current[imuSequenceHistoryRef.current.length - 1] ?? prev.lastSequence,
          }));
          pendingImuCountRef.current = 0;
          pendingFsrCountRef.current = 0;
          stateUpdateTimeoutRef.current = null;
        }, 100);
      }
      return;
    }

    // Handle FSR packet
    if (packetType === PacketType.FSR) {
      const chunk = parseFSRChunk(value);
      if (!chunk) return;

      // Assemble frame from chunks
      const frame = fsrAssemblerRef.current.addChunk(chunk);
      if (frame) {
        setLatestFSRFrame(frame);

        // Notify callbacks immediately (for data collection)
        fsrCallbacksRef.current.forEach(cb => cb(frame));

        // Throttle status updates (batched with IMU updates above)
        pendingFsrCountRef.current++;
      }
      return;
    }

    // Try legacy IMU format (no type header)
    const sample = parseIMUPacket(value);
    if (sample) {
      imuSequenceHistoryRef.current.push(sample.sequence);
      if (imuSequenceHistoryRef.current.length > 1000) {
        imuSequenceHistoryRef.current = imuSequenceHistoryRef.current.slice(-500);
      }

      // Notify callbacks immediately (for data collection)
      imuCallbacksRef.current.forEach(cb => cb(sample));

      // Throttle React state updates
      setLatestIMUSample(sample);
      pendingImuCountRef.current++;
    }
  }, []);

  /**
   * Start sensor data streaming
   */
  const startStreaming = useCallback(async (options?: { imu?: boolean; fsr?: boolean }): Promise<void> => {
    const deviceId = connectedDeviceRef.current;
    const streamImu = options?.imu ?? true;
    const streamFsr = options?.fsr ?? true;

    if (!isNative) {
      console.log('BLE: Simulating streaming in web mode');
      setConnectionStatus(prev => ({ ...prev, state: 'streaming' }));

      // Simulate IMU data
      let imuSeq = 0;
      let fsrSeq = 0;
      const imuIntervalId = setInterval(() => {
        if (!streamImu) return;
        const sample: ArduinoIMUSample = {
          timestamp: imuSeq * 10,
          accel: {
            x: Math.sin(imuSeq * 0.1) * 0.5,
            y: Math.cos(imuSeq * 0.1) * 0.5,
            z: 1 + Math.sin(imuSeq * 0.05) * 0.1,
          },
          gyro: {
            x: Math.sin(imuSeq * 0.2) * 100,
            y: Math.cos(imuSeq * 0.2) * 100,
            z: Math.sin(imuSeq * 0.15) * 50,
          },
          sequence: imuSeq++,
        };
        setLatestIMUSample(sample);
        imuCallbacksRef.current.forEach(cb => cb(sample));
      }, 10);

      // Simulate FSR data
      const fsrIntervalId = setInterval(() => {
        if (!streamFsr) return;
        const grid: number[][] = [];
        const flat: number[] = [];
        for (let r = 0; r < FSR_ROWS; r++) {
          const row: number[] = [];
          for (let c = 0; c < FSR_COLS; c++) {
            const val = Math.floor(Math.sin((fsrSeq + r * c) * 0.1) * 512 + 512);
            row.push(val);
            flat.push(val);
          }
          grid.push(row);
        }
        const frame: ArduinoFSRFrame = {
          frameSequence: fsrSeq++,
          timestamp: Date.now(),
          grid,
          flat,
        };
        setLatestFSRFrame(frame);
        fsrCallbacksRef.current.forEach(cb => cb(frame));
      }, 50);

      // Store interval IDs for cleanup
      (window as unknown as { __arduinoImuInterval?: NodeJS.Timeout }).__arduinoImuInterval = imuIntervalId;
      (window as unknown as { __arduinoFsrInterval?: NodeJS.Timeout }).__arduinoFsrInterval = fsrIntervalId;
      return;
    }

    if (!deviceId) {
      throw new Error('No device connected');
    }

    try {
      // Reset tracking
      imuSequenceHistoryRef.current = [];
      fsrAssemblerRef.current.clear();

      // Start notifications
      console.log('BLE: Starting sensor notifications');
      await BleClient.startNotifications(
        deviceId,
        ARDUINO_BLE_SERVICE_UUID,
        ARDUINO_SENSOR_DATA_CHAR_UUID,
        handleNotification
      );

      // Send appropriate START command
      let command: ArduinoCommand;
      if (streamImu && streamFsr) {
        command = ArduinoCommand.START_ALL;
      } else if (streamImu) {
        command = ArduinoCommand.START_IMU;
      } else if (streamFsr) {
        command = ArduinoCommand.START_FSR;
      } else {
        command = ArduinoCommand.START_ALL;
      }

      await sendCommand(deviceId, command);

      setConnectionStatus(prev => ({ ...prev, state: 'streaming' }));
      console.log('BLE: Streaming started');
    } catch (error) {
      console.error('BLE: Error starting streaming:', error);
      throw error;
    }
  }, [isNative, sendCommand, handleNotification]);

  /**
   * Stop sensor data streaming
   */
  const stopStreaming = useCallback(async (options?: { imu?: boolean; fsr?: boolean }): Promise<void> => {
    const deviceId = connectedDeviceRef.current;
    const stopImu = options?.imu ?? true;
    const stopFsr = options?.fsr ?? true;

    if (!isNative) {
      console.log('BLE: Stopping simulated streaming');
      const imuIntervalId = (window as unknown as { __arduinoImuInterval?: NodeJS.Timeout }).__arduinoImuInterval;
      const fsrIntervalId = (window as unknown as { __arduinoFsrInterval?: NodeJS.Timeout }).__arduinoFsrInterval;
      if (imuIntervalId && stopImu) clearInterval(imuIntervalId);
      if (fsrIntervalId && stopFsr) clearInterval(fsrIntervalId);
      setConnectionStatus(prev => ({
        ...prev,
        state: prev.state === 'streaming' ? 'connected' : prev.state,
      }));
      return;
    }

    if (!deviceId) return;

    try {
      // Send appropriate STOP command
      let command: ArduinoCommand;
      if (stopImu && stopFsr) {
        command = ArduinoCommand.STOP_ALL;
      } else if (stopImu) {
        command = ArduinoCommand.STOP_IMU;
      } else if (stopFsr) {
        command = ArduinoCommand.STOP_FSR;
      } else {
        command = ArduinoCommand.STOP_ALL;
      }

      await sendCommand(deviceId, command);

      // Stop notifications if stopping all
      if (stopImu && stopFsr) {
        await BleClient.stopNotifications(deviceId, ARDUINO_BLE_SERVICE_UUID, ARDUINO_SENSOR_DATA_CHAR_UUID);
        setConnectionStatus(prev => ({ ...prev, state: 'connected' }));
      }

      console.log('BLE: Streaming stopped');
    } catch (error) {
      console.error('BLE: Error stopping streaming:', error);
    }
  }, [isNative, sendCommand]);

  /**
   * Send ping command
   */
  const sendPing = useCallback(async (): Promise<void> => {
    const deviceId = connectedDeviceRef.current;
    if (!deviceId) throw new Error('No device connected');
    await sendCommand(deviceId, ArduinoCommand.PING);
  }, [sendCommand]);

  /**
   * Set device configuration
   */
  const setConfig = useCallback(async (newConfig: Partial<ArduinoSensorConfig>): Promise<void> => {
    const deviceId = connectedDeviceRef.current;

    if (!isNative || !deviceId) {
      console.log('BLE: Simulating config update');
      setConfigState(prev => prev ? { ...prev, ...newConfig } : null);
      return;
    }

    const mergedConfig: ArduinoSensorConfig = {
      imuRate: newConfig.imuRate ?? config?.imuRate ?? 100,
      fsrRate: newConfig.fsrRate ?? config?.fsrRate ?? 20,
      accelRange: newConfig.accelRange ?? config?.accelRange ?? 4,
      gyroRange: newConfig.gyroRange ?? config?.gyroRange ?? 2000,
    };

    try {
      const data = encodeSensorConfig(mergedConfig);
      await BleClient.write(deviceId, ARDUINO_BLE_SERVICE_UUID, ARDUINO_CONFIG_CHAR_UUID, data);
      setConfigState(mergedConfig);
      console.log('BLE: Config updated:', mergedConfig);
    } catch (error) {
      console.error('BLE: Error setting config:', error);
      throw error;
    }
  }, [isNative, config]);

  /**
   * Subscribe to IMU sample updates
   */
  const onIMUSample = useCallback((callback: (sample: ArduinoIMUSample) => void): () => void => {
    imuCallbacksRef.current.add(callback);
    return () => {
      imuCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Subscribe to FSR frame updates
   */
  const onFSRFrame = useCallback((callback: (frame: ArduinoFSRFrame) => void): () => void => {
    fsrCallbacksRef.current.add(callback);
    return () => {
      fsrCallbacksRef.current.delete(callback);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      // Cleanup state update throttle timer
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current);
      }

      // Cleanup simulated streaming
      const imuIntervalId = (window as unknown as { __arduinoImuInterval?: NodeJS.Timeout }).__arduinoImuInterval;
      const fsrIntervalId = (window as unknown as { __arduinoFsrInterval?: NodeJS.Timeout }).__arduinoFsrInterval;
      if (imuIntervalId) clearInterval(imuIntervalId);
      if (fsrIntervalId) clearInterval(fsrIntervalId);

      // Disconnect if connected
      const deviceId = connectedDeviceRef.current;
      if (deviceId && isNative && isInitializedRef.current) {
        BleClient.disconnect(deviceId).catch(console.error);
      }
    };
  }, [isNative]);

  return {
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
    sendPing,
    config,
    setConfig,
    // IMU data
    latestIMUSample,
    onIMUSample,
    // FSR data
    latestFSRFrame,
    onFSRFrame,
    // Legacy aliases
    latestSample: latestIMUSample,
    onSample: onIMUSample,
  };
}
