//
//  MotionManager.swift
//  Watchkit App Watch App
//

import Foundation
import CoreMotion
import WatchConnectivity

class MotionManager: NSObject, WCSessionDelegate {
    static let shared = MotionManager()

    private let motionManager = CMMotionManager()
    private var updateTimer: Timer?

    // Update frequency: 10 Hz (10 updates per second)
    private let updateInterval = 0.1

    private override init() {
        super.init()

        // Initialize WatchConnectivity
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }

        // Configure motion sensors
        motionManager.accelerometerUpdateInterval = updateInterval
        motionManager.gyroUpdateInterval = updateInterval
        motionManager.deviceMotionUpdateInterval = updateInterval
    }

    // MARK: - Motion Data Collection

    func startMotionUpdates() {
        guard motionManager.isDeviceMotionAvailable else {
            print("❌ Motion sensors not available")
            return
        }

        // Start device motion (includes all sensors)
        motionManager.startDeviceMotionUpdates()

        // Send updates at regular intervals
        updateTimer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: true) { [weak self] _ in
            self?.sendMotionData()
        }

        print("✅ Started Watch motion updates")
    }

    func stopMotionUpdates() {
        motionManager.stopDeviceMotionUpdates()
        updateTimer?.invalidate()
        updateTimer = nil
        print("🛑 Stopped Watch motion updates")
    }

    private func sendMotionData() {
        guard let motion = motionManager.deviceMotion,
              WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            return
        }

        // Orientation (Euler angles in radians)
        let roll = motion.attitude.roll
        let pitch = motion.attitude.pitch
        let yaw = motion.attitude.yaw

        // Accelerometer (user acceleration, g units, gravity removed)
        let accelX = motion.userAcceleration.x
        let accelY = motion.userAcceleration.y
        let accelZ = motion.userAcceleration.z

        // Gyroscope (rotation rate, rad/s)
        let gyroX = motion.rotationRate.x
        let gyroY = motion.rotationRate.y
        let gyroZ = motion.rotationRate.z

        // Prepare data payload
        let data: [String: Any] = [
            "type": "motion_data",
            "source": "watch",
            "timestamp": Date().timeIntervalSince1970,
            "accel": [
                "x": accelX,
                "y": accelY,
                "z": accelZ
            ],
            "gyro": [
                "x": gyroX,
                "y": gyroY,
                "z": gyroZ
            ],
            "orientation": [
                "roll": roll,
                "pitch": pitch,
                "yaw": yaw
            ]
        ]

        // Send to iPhone
        WCSession.default.sendMessage(data, replyHandler: nil) { error in
            // Silent fail - don't spam console
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("❌ Watch session failed: \(error.localizedDescription)")
        } else {
            print("✅ Watch session ready")
        }
    }
}
