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
    private var messageCount = 0  // Track how many messages sent

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
        print("   - iPhone reachable: \(WCSession.default.isReachable)")
        print("   - Will use: \(WCSession.default.isReachable ? "sendMessage (fast)" : "transferUserInfo (reliable)")")
    }

    func stopMotionUpdates() {
        motionManager.stopDeviceMotionUpdates()
        updateTimer?.invalidate()
        updateTimer = nil
        print("🛑 Stopped Watch motion updates (sent \(messageCount) messages)")
        messageCount = 0
    }

    private func sendMotionData() {
        guard let motion = motionManager.deviceMotion,
              WCSession.default.activationState == .activated else {
            return
        }
        
        messageCount += 1

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
            "messageCount": messageCount,
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

        // Try to send immediately if iPhone is reachable (foreground-to-foreground)
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(data, replyHandler: { reply in
                // Successfully delivered and got reply
                if let status = reply["status"] as? String {
                    // Only log every 10th message to reduce spam
                    if self.messageCount % 10 == 0 {
                        print("✅ Motion data delivered via sendMessage (count: \(self.messageCount), status: \(status))")
                    }
                }
            }) { error in
                print("⚠️ sendMessage failed (count: \(self.messageCount)): \(error.localizedDescription)")
                // Fallback to background transfer
                let transfer = WCSession.default.transferUserInfo(data)
                print("📤 Fallback: queued via transferUserInfo (outstanding: \(transfer.isTransferring))")
            }
        } else {
            // iPhone not immediately reachable - use background transfer
            let transfer = WCSession.default.transferUserInfo(data)
            // Only log every 10th message to reduce spam
            if messageCount % 10 == 0 {
                print("📤 Motion data queued via transferUserInfo (count: \(messageCount), outstanding: \(transfer.isTransferring))")
            }
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("❌ Watch session failed: \(error.localizedDescription)")
        } else {
            print("✅ Watch session ready")
            print("   - isReachable: \(session.isReachable)")
            print("   - activationState: \(activationState.rawValue)")
        }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        print("📡 iPhone reachability changed: \(session.isReachable ? "REACHABLE ✅" : "NOT REACHABLE ❌")")
    }
}
