//
//  MotionManager.swift
//  Watchkit App Watch App
//

import Foundation
import CoreMotion
import WatchConnectivity
import WatchKit
import Combine

// Watch UI State for different screens
enum WatchUIState: Equatable {
    case ready
    case remoteControlled
    case calibrationStart(message: String)
    case calibrationCountdown(count: Int)
    case calibrationSqueeze(progress: Int)
    case calibrationDone(maxForce: Double)
    case waitingForRecordingCommand
    case recording
}

class MotionManager: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = MotionManager()

    private let motionManager = CMMotionManager()
    private var updateTimer: Timer?
    private var messageCount = 0  // Track how many messages sent

    // Update frequency: 100 Hz (100 updates per second) - 10x improvement
    private let updateInterval = 0.01

    // Batching streamer for 100Hz streaming with binary encoding
    private let batchingStreamer = BatchingMotionStreamer()

    // Recording state
    @Published var isRecording = false
    @Published var isRemoteControlled = false  // True when iOS controls recording
    private(set) var recordingStartTime: Date?
    private var currentSessionId: String?

    // Planned duration and time notifications
    private var plannedDurationMinutes: Int = 0
    private var notificationTimers: [Timer] = []
    @Published var timeRemainingNotification: String? = nil  // Auto-dismissing notification text

    // UI State for calibration and recording control
    @Published var uiState: WatchUIState = .ready

    // Can user start recording from Watch?
    @Published var canStartRecording = false
    private var pendingSessionId: String?

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

        // Request HealthKit permission early for workout sessions
        WorkoutManager.shared.requestHealthKitPermission { granted in
            print("🏃 HealthKit permission: \(granted ? "granted" : "denied")")
        }
    }

    // MARK: - Motion Data Collection

    func startMotionUpdates(isRemote: Bool = false, sessionId: String? = nil, plannedDuration: Int = 0) {
        guard motionManager.isDeviceMotionAvailable else {
            print("❌ Motion sensors not available")
            return
        }

        // Set recording start time for relative timestamps
        recordingStartTime = Date()
        currentSessionId = sessionId
        isRemoteControlled = isRemote
        isRecording = true
        plannedDurationMinutes = plannedDuration

        // Start device motion (includes all sensors)
        motionManager.startDeviceMotionUpdates()

        // Start batching streamer for 100Hz binary streaming
        batchingStreamer.startStreaming(sessionId: sessionId)

        // Send updates at regular intervals (100Hz)
        updateTimer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: true) { [weak self] _ in
            self?.sendMotionData()
        }

        // Start audio streaming via AudioStreamManager
        AudioStreamManager.shared.startStreaming()

        // Set up time remaining notifications if we have a planned duration
        setupTimeRemainingNotifications()

        let controlType = isRemote ? "REMOTE (iOS)" : "LOCAL (Watch)"
        print("✅ Started Watch motion updates (\(controlType))")
        print("   - Session ID: \(sessionId ?? "none")")
        print("   - Start time: \(recordingStartTime!)")
        print("   - Planned duration: \(plannedDuration) min")
        print("   - iPhone reachable: \(WCSession.default.isReachable)")
        print("   - Will use: \(WCSession.default.isReachable ? "sendMessage (fast)" : "transferUserInfo (reliable)")")
    }

    // MARK: - Time Remaining Notifications

    private func setupTimeRemainingNotifications() {
        // Clear any existing timers
        cancelNotificationTimers()

        guard plannedDurationMinutes > 0, let startTime = recordingStartTime else {
            print("⏱️ No planned duration, skipping time notifications")
            return
        }

        let totalSeconds = plannedDurationMinutes * 60

        // Calculate when to show 5-minute warning
        let fiveMinWarningTime = totalSeconds - (5 * 60)
        if fiveMinWarningTime > 0 {
            let timer = Timer.scheduledTimer(withTimeInterval: TimeInterval(fiveMinWarningTime), repeats: false) { [weak self] _ in
                self?.showTimeRemainingNotification(minutes: 5)
            }
            notificationTimers.append(timer)
            print("⏱️ Scheduled 5-minute warning in \(fiveMinWarningTime)s")
        }

        // Calculate when to show 1-minute warning
        let oneMinWarningTime = totalSeconds - 60
        if oneMinWarningTime > 0 {
            let timer = Timer.scheduledTimer(withTimeInterval: TimeInterval(oneMinWarningTime), repeats: false) { [weak self] _ in
                self?.showTimeRemainingNotification(minutes: 1)
            }
            notificationTimers.append(timer)
            print("⏱️ Scheduled 1-minute warning in \(oneMinWarningTime)s")
        }
    }

    private func showTimeRemainingNotification(minutes: Int) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.isRecording else { return }

            // Play haptic
            WKInterfaceDevice.current().play(.notification)

            // Show notification text
            self.timeRemainingNotification = "\(minutes) min left"
            print("⏱️ Showing time notification: \(minutes) min left")

            // Auto-dismiss after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
                self?.timeRemainingNotification = nil
            }
        }
    }

    private func cancelNotificationTimers() {
        for timer in notificationTimers {
            timer.invalidate()
        }
        notificationTimers.removeAll()
        timeRemainingNotification = nil
    }

    func stopMotionUpdates(endWorkout: Bool = false) {
        // Stop audio streaming
        AudioStreamManager.shared.stopStreaming()

        // Stop batching streamer
        batchingStreamer.stopStreaming()

        // Cancel time remaining notification timers
        cancelNotificationTimers()

        motionManager.stopDeviceMotionUpdates()
        updateTimer?.invalidate()
        updateTimer = nil

        let controlType = isRemoteControlled ? "REMOTE (iOS)" : "LOCAL (Watch)"
        let stats = batchingStreamer.getStats()
        print("🛑 Stopped Watch motion updates (\(controlType))")
        print("   - Samples pushed: \(stats.samplesPushed)")
        print("   - Batches sent: \(stats.batchesSent)")
        print("   - Buffer: count=\(stats.bufferStats.count), seq=\(stats.bufferStats.lowest)-\(stats.bufferStats.highest)")

        messageCount = 0
        recordingStartTime = nil
        currentSessionId = nil
        plannedDurationMinutes = 0
        isRecording = false
        isRemoteControlled = false

        // Stop workout session if requested (when stopping locally from Watch)
        if endWorkout {
            WorkoutManager.shared.stopWorkoutSession(saveToHealth: true)
        }
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

        // Calculate relative timestamp (milliseconds since recording started)
        let relativeTimeMs: UInt32
        if let startTime = recordingStartTime {
            relativeTimeMs = UInt32(Date().timeIntervalSince(startTime) * 1000)
        } else {
            relativeTimeMs = 0
        }

        // Push sample to batching streamer (handles binary encoding and batching)
        batchingStreamer.pushSample(
            relativeTimeMs: relativeTimeMs,
            accelX: accelX,
            accelY: accelY,
            accelZ: accelZ,
            gyroX: gyroX,
            gyroY: gyroY,
            gyroZ: gyroZ,
            roll: roll,
            pitch: pitch,
            yaw: yaw
        )

        // Log progress occasionally (every 1000 samples = 10 seconds at 100Hz)
        if messageCount % 1000 == 0 {
            print("📊 Motion samples collected: \(messageCount)")
        }
    }

    // MARK: - Command Handling

    private func handleCommand(_ command: String, sessionId: String? = nil, timestamp: Double? = nil, plannedDuration: Int? = nil) {
        print("📱 Received command from iOS: \(command)")
        print("   - Session ID: \(sessionId ?? "none")")
        print("   - Timestamp: \(timestamp ?? 0)")
        print("   - Planned Duration: \(plannedDuration ?? 0) min")

        switch command {
        case "START":
            if !isRecording {
                DispatchQueue.main.async { [weak self] in
                    self?.startMotionUpdates(isRemote: true, sessionId: sessionId, plannedDuration: plannedDuration ?? 0)
                    self?.uiState = .recording
                }
            } else if let duration = plannedDuration, duration > 0, plannedDurationMinutes == 0 {
                // Already recording but received START with plannedDuration - update duration and set up notifications
                // This handles the race condition where Watch starts recording before iOS sends the full command
                DispatchQueue.main.async { [weak self] in
                    guard let self = self else { return }
                    self.plannedDurationMinutes = duration
                    self.setupTimeRemainingNotifications()
                    print("⏱️ Updated planned duration to \(duration) min while already recording")
                }
            } else {
                print("⚠️ Already recording with duration \(plannedDurationMinutes) min, ignoring START command")
            }

        case "STOP":
            if isRecording {
                DispatchQueue.main.async { [weak self] in
                    self?.stopMotionUpdates()
                    self?.uiState = .ready
                    self?.canStartRecording = false

                    // Stop workout session when recording ends
                    WorkoutManager.shared.stopWorkoutSession(saveToHealth: true)
                }
            } else {
                print("⚠️ Not recording, ignoring STOP command")
            }

        default:
            print("⚠️ Unknown command: \(command)")
        }
    }

    // MARK: - Calibration Command Handling

    private func handleCalibrationCommand(_ message: [String: Any]) {
        guard let command = message["command"] as? String else {
            print("⚠️ Calibration message missing command")
            return
        }

        print("🎯 Watch received calibration command: \(command)")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            switch command {
            case "CALIBRATE_START":
                let msg = message["message"] as? String ?? "Get ready!"
                self.uiState = .calibrationStart(message: msg)
                print("📱 Watch UI: Calibration Start - \(msg)")

                // Start workout session asynchronously to avoid blocking calibration UI
                DispatchQueue.global(qos: .userInitiated).async {
                    WorkoutManager.shared.startWorkoutSession()
                }

            case "CALIBRATE_COUNTDOWN":
                let countdown = message["countdown"] as? Int ?? 3
                self.uiState = .calibrationCountdown(count: countdown)
                print("📱 Watch UI: Countdown \(countdown)")

            case "CALIBRATE_SQUEEZE":
                let progress = message["progress"] as? Int ?? 1
                self.uiState = .calibrationSqueeze(progress: progress)
                print("📱 Watch UI: Squeeze progress \(progress)")

            case "CALIBRATE_DONE":
                let maxForce = message["maxForce"] as? Double ?? 0.0
                self.uiState = .calibrationDone(maxForce: maxForce)
                print("📱 Watch UI: Calibration done - max force \(maxForce)")

            case "ENABLE_RECORDING_CONTROL":
                let sessionId = message["sessionId"] as? String
                self.pendingSessionId = sessionId
                self.canStartRecording = true
                self.uiState = .waitingForRecordingCommand
                print("📱 Watch UI: Ready to start recording (session: \(sessionId ?? "none"))")

            default:
                print("⚠️ Unknown calibration command: \(command)")
            }
        }
    }

    // MARK: - Recording Control from Watch

    func sendRecordingControl(action: String) {
        let session = WCSession.default

        print("🚨🚨🚨 Watch sendRecordingControl(\(action)) 🚨🚨🚨")
        print("   - activationState: \(session.activationState.rawValue) (0=notActivated, 1=inactive, 2=activated)")
        print("   - isReachable: \(session.isReachable)")
        print("   - isCompanionAppInstalled: \(session.isCompanionAppInstalled)")
        print("   - isRemoteControlled: \(isRemoteControlled)")
        print("   - isRecording: \(isRecording)")

        guard session.activationState == .activated else {
            print("❌ Cannot send recording control: session not activated (state=\(session.activationState.rawValue))")
            return
        }

        let message: [String: Any] = [
            "type": "recording_control",
            "action": action,
            "sessionId": pendingSessionId ?? "",
            "timestamp": Date().timeIntervalSince1970
        ]

        // Try all methods simultaneously to maximize chances of delivery during workout
        print("📤 Attempting ALL delivery methods for: \(action)")

        // Method 1: sendMessage (fastest but may fail during workout)
        if session.isReachable {
            print("📤 [1/3] Trying sendMessage (isReachable=true)...")
            session.sendMessage(message, replyHandler: { reply in
                print("✅ [1/3] sendMessage succeeded! iOS replied: \(reply)")
            }) { error in
                print("⚠️ [1/3] sendMessage failed: \(error.localizedDescription)")
            }
        } else {
            print("⚠️ [1/3] Skipping sendMessage (isReachable=false)")
        }

        // Method 2: transferUserInfo (reliable but may be delayed)
        print("📤 [2/3] Trying transferUserInfo...")
        session.transferUserInfo(message)
        print("✅ [2/3] transferUserInfo queued")

        // Method 3: updateApplicationContext (immediate but only stores latest)
        print("📤 [3/3] Trying updateApplicationContext...")
        do {
            try session.updateApplicationContext([
                "type": "recording_control",
                "action": action,
                "sessionId": pendingSessionId ?? "",
                "timestamp": Date().timeIntervalSince1970
            ])
            print("✅ [3/3] updateApplicationContext succeeded")
        } catch {
            print("⚠️ [3/3] updateApplicationContext failed: \(error.localizedDescription)")
        }

        print("🚨 Watch sendRecordingControl(\(action)) - all delivery methods attempted")
    }

    func startRecordingFromWatch() {
        guard canStartRecording else {
            print("⚠️ Cannot start recording: not enabled")
            return
        }

        sendRecordingControl(action: "START")

        // Update UI state - actual recording will start when iOS sends START command
        DispatchQueue.main.async { [weak self] in
            self?.uiState = .recording
        }
    }

    func stopRecordingFromWatch() {
        sendRecordingControl(action: "STOP")
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

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        print("📥 Watch received message from iOS: \(message.keys)")

        guard let type = message["type"] as? String else {
            print("⚠️ Message missing type")
            return
        }

        switch type {
        case "command":
            let command = message["command"] as? String ?? ""
            let sessionId = message["sessionId"] as? String
            let timestamp = message["timestamp"] as? Double
            let plannedDuration = message["plannedDuration"] as? Int
            handleCommand(command, sessionId: sessionId, timestamp: timestamp, plannedDuration: plannedDuration)

        case "calibration":
            handleCalibrationCommand(message)

        default:
            print("⚠️ Unknown message type: \(type)")
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        print("📥 Watch received message from iOS (with reply): \(message.keys)")

        guard let type = message["type"] as? String else {
            replyHandler(["status": "error", "message": "Missing type"])
            return
        }

        switch type {
        case "command":
            let command = message["command"] as? String ?? ""
            let sessionId = message["sessionId"] as? String
            let timestamp = message["timestamp"] as? Double
            let plannedDuration = message["plannedDuration"] as? Int
            handleCommand(command, sessionId: sessionId, timestamp: timestamp, plannedDuration: plannedDuration)
            replyHandler([
                "status": "ok",
                "command": command,
                "isRecording": isRecording
            ])

        case "calibration":
            handleCalibrationCommand(message)
            let command = message["command"] as? String ?? ""
            replyHandler([
                "status": "ok",
                "command": command
            ])

        default:
            replyHandler(["status": "unknown_type"])
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        print("📡 iPhone reachability changed: \(session.isReachable ? "REACHABLE ✅" : "NOT REACHABLE ❌")")
    }

    // MARK: - Binary Data Handling (for recovery requests)

    func session(_ session: WCSession, didReceiveMessageData messageData: Data) {
        // Handle recovery request from iOS
        if let request = MotionBinaryCodec.decodeRecoveryRequest(messageData) {
            print("📥 Received recovery request for seq \(request.fromSeq)-\(request.toSeq)")
            batchingStreamer.handleRecoveryRequest(fromSeq: request.fromSeq, toSeq: request.toSeq)
            return
        }

        // Handle acknowledgment from iOS
        if let seq = MotionBinaryCodec.decodeAcknowledgment(messageData) {
            batchingStreamer.handleAcknowledgment(throughSequence: seq)
            return
        }

        print("⚠️ Received unknown binary message data (size: \(messageData.count))")
    }

    func session(_ session: WCSession, didReceiveMessageData messageData: Data, replyHandler: @escaping (Data) -> Void) {
        // Handle recovery request with reply
        if let request = MotionBinaryCodec.decodeRecoveryRequest(messageData) {
            print("📥 Received recovery request (with reply) for seq \(request.fromSeq)-\(request.toSeq)")
            batchingStreamer.handleRecoveryRequest(fromSeq: request.fromSeq, toSeq: request.toSeq)
            replyHandler(Data([0x00]))  // ACK
            return
        }

        // Handle acknowledgment with reply
        if let seq = MotionBinaryCodec.decodeAcknowledgment(messageData) {
            batchingStreamer.handleAcknowledgment(throughSequence: seq)
            replyHandler(Data([0x00]))  // ACK
            return
        }

        print("⚠️ Received unknown binary message data (size: \(messageData.count))")
        replyHandler(Data([0xFF]))  // NACK
    }
}
