interface FormattedMotionData {
  accel: { x: string; y: string; z: string };
  gyro: { x: string; y: string; z: string };
  orientation: { roll: string; pitch: string; yaw: string };
}

interface MotionDataDisplayProps {
  data: FormattedMotionData | null;
}

const defaultData: FormattedMotionData = {
  accel: { x: '0.000', y: '0.000', z: '0.000' },
  gyro: { x: '0.000', y: '0.000', z: '0.000' },
  orientation: { roll: '0.0', pitch: '0.0', yaw: '0.0' },
};

function MotionDataDisplay({ data }: MotionDataDisplayProps) {
  const displayData = data ?? defaultData;

  return (
    <>
      <div className="motion-data">
        <h3>Accelerometer (g)</h3>
        <div className="data-row">
          X: <span>{displayData.accel.x}</span>
        </div>
        <div className="data-row">
          Y: <span>{displayData.accel.y}</span>
        </div>
        <div className="data-row">
          Z: <span>{displayData.accel.z}</span>
        </div>
      </div>

      <div className="motion-data">
        <h3>Gyroscope (rad/s)</h3>
        <div className="data-row">
          X: <span>{displayData.gyro.x}</span>
        </div>
        <div className="data-row">
          Y: <span>{displayData.gyro.y}</span>
        </div>
        <div className="data-row">
          Z: <span>{displayData.gyro.z}</span>
        </div>
      </div>

      <div className="motion-data">
        <h3>Orientation (degrees)</h3>
        <div className="data-row">
          Roll: <span>{displayData.orientation.roll}°</span>
        </div>
        <div className="data-row">
          Pitch: <span>{displayData.orientation.pitch}°</span>
        </div>
        <div className="data-row">
          Yaw: <span>{displayData.orientation.yaw}°</span>
        </div>
      </div>
    </>
  );
}

export default MotionDataDisplay;
