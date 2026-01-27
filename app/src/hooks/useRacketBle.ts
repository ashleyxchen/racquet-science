import { useState, useCallback, useRef } from 'react';
import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export function useRacketBle() {
  const [isConnected, setIsConnected] = useState(false);
  const [charValue, setCharValue] = useState<string>('');
  const deviceRef = useRef<BleDevice | null>(null);

  const connect = useCallback(async () => {
    try {
      await BleClient.initialize();

      const device = await BleClient.requestDevice({});

      await BleClient.connect(device.deviceId, (deviceId) => {
        console.log(`device ${deviceId} disconnected`);
        setIsConnected(false);
        deviceRef.current = null;
      });

      console.log('connected to device', device);
      deviceRef.current = device;
      setIsConnected(true);
    } catch (error) {
      console.error('BLE connection error:', error);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!deviceRef.current) {
      console.error('No device connected');
      return;
    }

    try {
      await BleClient.startNotifications(
        deviceRef.current.deviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (value) => {
          const charData = value.getUint32(0, true).toString();
          console.log('char data received:', charData);
          setCharValue(charData);
        }
      );
    } catch (error) {
      console.error('Error starting notifications:', error);
    }
  }, []);

  return {
    isConnected,
    charValue,
    connect,
    startListening,
  };
}
