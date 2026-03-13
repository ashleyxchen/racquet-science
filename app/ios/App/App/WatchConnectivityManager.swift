//
//  WatchConnectivityManager.swift
//  App
//

import Foundation
import WatchConnectivity

class WatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()

    // Store latest motion data from Watch
    var latestMotionData: [String: Any] = [:]

    // Store latest audio dB level
    var latestAudioDbLevel: Float = -60.0

    // Callback for forwarding motion data to plugin (legacy JSON format)
    private var onMotionData: (([String: Any]) -> Void)?

    // Callback for forwarding motion batch data to plugin (new binary format)
    private var onMotionBatch: ((_ samples: [[String: Any]], _ sessionId: String) -> Void)?

    // Callback for forwarding audio data to plugin and playback manager
    private var onAudioData: ((_ audioData: Data, _ dbLevel: Float) -> Void)?

    // Callback for forwarding recording control messages from Watch
    private var onRecordingControl: ((_ action: String) -> Void)?

    // Callback for forwarding pain notes from Watch
    private var onPainNote: ((_ painNote: [String: Any]) -> Void)?

    // Sequence tracking for gap detection
    private var expectedSequence: UInt32 = 0
    private var isFirstBatch = true
    private var totalSamplesReceived: Int = 0
    private var gapsDetected: Int = 0
    private var recoveryRequestsSent: Int = 0

    // Register callback to receive motion data directly (legacy JSON format)
    func setMotionDataCallback(_ callback: @escaping ([String: Any]) -> Void) {
        self.onMotionData = callback
        print("📱 WatchConnectivityManager: Motion callback registered")

        // If we already have data, send it immediately
        if !latestMotionData.isEmpty {
            print("📱 WatchConnectivityManager: Sending cached data via callback")
            callback(latestMotionData)
        }
    }

    // Register callback to receive motion batch data (new binary format)
    func setMotionBatchCallback(_ callback: @escaping (_ samples: [[String: Any]], _ sessionId: String) -> Void) {
        self.onMotionBatch = callback
        print("📱 WatchConnectivityManager: Motion batch callback registered")
    }

    // Reset sequence tracking (call when starting a new recording)
    func resetSequenceTracking() {
        expectedSequence = 0
        isFirstBatch = true
        totalSamplesReceived = 0
        gapsDetected = 0
        recoveryRequestsSent = 0
        print("📱 WatchConnectivityManager: Sequence tracking reset")
    }

    // Get statistics for debugging
    func getMotionBatchStats() -> [String: Any] {
        return [
            "totalSamplesReceived": totalSamplesReceived,
            "expectedSequence": expectedSequence,
            "gapsDetected": gapsDetected,
            "recoveryRequestsSent": recoveryRequestsSent
        ]
    }

    // Register callback to receive audio data
    func setAudioDataCallback(_ callback: @escaping (_ audioData: Data, _ dbLevel: Float) -> Void) {
        self.onAudioData = callback
        print("📱 WatchConnectivityManager: Audio callback registered")
    }

    // Register callback to receive recording control messages from Watch
    func setRecordingControlCallback(_ callback: @escaping (_ action: String) -> Void) {
        self.onRecordingControl = callback
        print("📱 WatchConnectivityManager: Recording control callback registered")
    }

    // Register callback to receive pain notes from Watch
    func setPainNoteCallback(_ callback: @escaping (_ painNote: [String: Any]) -> Void) {
        self.onPainNote = callback
        print("📱 WatchConnectivityManager: Pain note callback registered")
    }

    private override init() {
        super.init()

        print("📱 WatchConnectivityManager: Initializing...")
        
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
            print("📱 iOS WatchConnectivity activated")
        } else {
            print("❌ WatchConnectivity not supported on this device")
        }
    }

    // MARK: - Receive Motion Data from Watch

    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        // Debug logging disabled for performance - was blocking at 100Hz
        // Uncomment for troubleshooting:
        // print("📥 Received message from Watch: \(message.keys)")

        if let type = message["type"] as? String {
            switch type {
            case "motion_data":
                // Store latest data
                latestMotionData = message

                // Forward directly to plugin if registered
                DispatchQueue.main.async { [weak self] in
                    if let callback = self?.onMotionData {
                        callback(message)
                    } else {
                        NotificationCenter.default.post(
                            name: NSNotification.Name("WatchMotionDataReceived"),
                            object: nil,
                            userInfo: message
                        )
                    }
                }

                // Send acknowledgment back to Watch
                replyHandler(["status": "received"])

            case "recording_control":
                // Handle recording control from Watch
                if let action = message["action"] as? String {
                    print("📱 Received recording control from Watch: \(action)")
                    DispatchQueue.main.async { [weak self] in
                        self?.onRecordingControl?(action)
                        NotificationCenter.default.post(
                            name: NSNotification.Name("WatchRecordingControl"),
                            object: nil,
                            userInfo: ["action": action]
                        )
                    }
                    replyHandler(["status": "received", "action": action])
                } else {
                    replyHandler(["status": "error", "message": "Missing action"])
                }

            case "pain_note":
                // Handle pain note from Watch
                print("📱 Received pain note from Watch")
                DispatchQueue.main.async { [weak self] in
                    self?.onPainNote?(message)
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchPainNoteReceived"),
                        object: nil,
                        userInfo: message
                    )
                }
                replyHandler(["status": "received"])

            default:
                print("⚠️ Received message with unknown type: \(type)")
                replyHandler(["status": "ignored"])
            }
        } else {
            print("⚠️ Received message without type")
            replyHandler(["status": "ignored"])
        }
    }
    
    // Also handle messages without reply handler (just in case)
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        // Debug logging disabled for performance
        // print("📥 Received message from Watch (no reply): \(message.keys)")

        if let type = message["type"] as? String {
            switch type {
            case "motion_data":
                // Store latest data
                latestMotionData = message

                // Forward directly to plugin if registered
                DispatchQueue.main.async { [weak self] in
                    if let callback = self?.onMotionData {
                        callback(message)
                    } else {
                        NotificationCenter.default.post(
                            name: NSNotification.Name("WatchMotionDataReceived"),
                            object: nil,
                            userInfo: message
                        )
                    }
                }

            case "recording_control":
                // Handle recording control from Watch
                if let action = message["action"] as? String {
                    print("📱 Received recording control from Watch: \(action)")
                    DispatchQueue.main.async { [weak self] in
                        self?.onRecordingControl?(action)
                        NotificationCenter.default.post(
                            name: NSNotification.Name("WatchRecordingControl"),
                            object: nil,
                            userInfo: ["action": action]
                        )
                    }
                }

            case "pain_note":
                // Handle pain note from Watch
                print("📱 Received pain note from Watch")
                DispatchQueue.main.async { [weak self] in
                    self?.onPainNote?(message)
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchPainNoteReceived"),
                        object: nil,
                        userInfo: message
                    )
                }

            default:
                print("⚠️ Received message with unknown type: \(type)")
            }
        } else {
            print("⚠️ Received message without type")
        }
    }
    
    // Receive background transfers (more reliable than sendMessage)
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        print("📦 Received userInfo from Watch: \(userInfo.keys)")

        guard let type = userInfo["type"] as? String else {
            print("⚠️ Received userInfo without type")
            return
        }

        switch type {
        case "motion_data":
            // Store latest data
            latestMotionData = userInfo

            // Forward directly via callback if registered
            DispatchQueue.main.async { [weak self] in
                if let callback = self?.onMotionData {
                    callback(userInfo)
                } else {
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchMotionDataReceived"),
                        object: nil,
                        userInfo: userInfo
                    )
                }
            }

        case "recording_control":
            // Handle recording control from Watch (via transferUserInfo fallback)
            if let action = userInfo["action"] as? String {
                print("📱 Received recording control via userInfo from Watch: \(action)")
                DispatchQueue.main.async { [weak self] in
                    self?.onRecordingControl?(action)
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchRecordingControl"),
                        object: nil,
                        userInfo: ["action": action]
                    )
                }
            }

        case "pain_note":
            // Handle pain note from Watch (via transferUserInfo fallback)
            print("📱 Received pain note via userInfo from Watch")
            DispatchQueue.main.async { [weak self] in
                self?.onPainNote?(userInfo)
                NotificationCenter.default.post(
                    name: NSNotification.Name("WatchPainNoteReceived"),
                    object: nil,
                    userInfo: userInfo
                )
            }

        default:
            print("⚠️ Unknown userInfo type: \(type)")
        }
    }

    // MARK: - Receive Binary Data from Watch (Motion Batches and Audio)

    func session(_ session: WCSession, didReceiveMessageData messageData: Data) {
        // Check if this is a motion batch (starts with 0x01 or 0x03)
        if messageData.count >= MotionBinaryCodec.batchHeaderSize {
            let messageType = messageData[0]
            if messageType == MotionMessageType.motionBatch.rawValue ||
               messageType == MotionMessageType.recoveryResponse.rawValue {
                handleMotionBatch(messageData, isRecovery: messageType == MotionMessageType.recoveryResponse.rawValue)
                return
            }
        }

        // Audio data packet format: [4 bytes dB level][PCM Float32 data]
        guard messageData.count > 4 else {
            print("⚠️ WatchConnectivityManager: Unknown binary data (size: \(messageData.count))")
            return
        }

        // Extract dB level from first 4 bytes
        let dbLevel = messageData.withUnsafeBytes { ptr -> Float in
            ptr.load(as: Float.self)
        }

        // Extract PCM audio data (remaining bytes)
        let audioData = messageData.subdata(in: 4..<messageData.count)

        // Update latest dB level
        latestAudioDbLevel = dbLevel

        // Forward to AudioPlaybackManager for playback
        DispatchQueue.main.async { [weak self] in
            // Forward to playback manager
            AudioPlaybackManager.shared.receiveAudioData(audioData, dbLevel: dbLevel)

            // Notify via callback (for Capacitor plugin)
            self?.onAudioData?(audioData, dbLevel)

            // Post notification for any other listeners
            NotificationCenter.default.post(
                name: NSNotification.Name("WatchAudioDataReceived"),
                object: nil,
                userInfo: ["dbLevel": dbLevel, "dataSize": audioData.count]
            )
        }
    }

    // MARK: - Motion Batch Handling

    private func handleMotionBatch(_ data: Data, isRecovery: Bool) {
        guard let batch = MotionBinaryCodec.decodeBatch(data) else {
            print("⚠️ WatchConnectivityManager: Failed to decode motion batch")
            return
        }

        // Track first batch to initialize sequence
        if isFirstBatch && !batch.samples.isEmpty {
            expectedSequence = batch.samples[0].sequence
            isFirstBatch = false
            print("📱 WatchConnectivityManager: First batch received, starting at seq \(expectedSequence)")
        }

        // Check for gaps (only for regular batches, not recovery)
        if !isRecovery && !batch.samples.isEmpty {
            let firstSeq = batch.samples[0].sequence
            if firstSeq > expectedSequence {
                let gapSize = firstSeq - expectedSequence
                gapsDetected += 1
                print("⚠️ WatchConnectivityManager: Gap detected! Expected \(expectedSequence), got \(firstSeq) (missing \(gapSize) samples)")

                // Send recovery request for missed samples
                sendRecoveryRequest(fromSeq: expectedSequence, toSeq: firstSeq - 1)
            }

            // Update expected sequence
            if let lastSample = batch.samples.last {
                expectedSequence = lastSample.sequence + 1
            }
        }

        // Convert to dictionary format for JavaScript
        var sampleDicts: [[String: Any]] = []
        sampleDicts.reserveCapacity(batch.samples.count)

        for sample in batch.samples {
            let dict: [String: Any] = [
                "sequence": sample.sequence,
                "relativeTimeMs": sample.relativeTimeMs,
                "accel": [
                    "x": sample.accelX,
                    "y": sample.accelY,
                    "z": sample.accelZ
                ],
                "gyro": [
                    "x": sample.gyroX,
                    "y": sample.gyroY,
                    "z": sample.gyroZ
                ],
                "orientation": [
                    "roll": sample.roll,
                    "pitch": sample.pitch,
                    "yaw": sample.yaw
                ]
            ]
            sampleDicts.append(dict)
        }

        totalSamplesReceived += batch.samples.count

        // Log progress occasionally
        if totalSamplesReceived % 1000 == 0 {
            print("📱 WatchConnectivityManager: \(totalSamplesReceived) samples received, \(gapsDetected) gaps detected")
        }

        // Forward to callback
        DispatchQueue.main.async { [weak self] in
            self?.onMotionBatch?(sampleDicts, batch.sessionId)

            // Post notification for any other listeners
            NotificationCenter.default.post(
                name: NSNotification.Name("WatchMotionBatchReceived"),
                object: nil,
                userInfo: [
                    "samples": sampleDicts,
                    "sessionId": batch.sessionId,
                    "isRecovery": isRecovery
                ]
            )
        }
    }

    // MARK: - Recovery Protocol

    private func sendRecoveryRequest(fromSeq: UInt32, toSeq: UInt32) {
        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            print("⚠️ WatchConnectivityManager: Cannot send recovery request - Watch not reachable")
            return
        }

        // Limit recovery requests to avoid flooding
        let maxRecoveryGap: UInt32 = 100  // Only try to recover up to 100 samples
        let actualToSeq = min(toSeq, fromSeq + maxRecoveryGap - 1)

        let requestData = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: fromSeq, toSeq: actualToSeq)

        WCSession.default.sendMessageData(requestData, replyHandler: nil) { error in
            print("❌ WatchConnectivityManager: Recovery request failed: \(error.localizedDescription)")
        }

        recoveryRequestsSent += 1
        print("📱 WatchConnectivityManager: Sent recovery request for seq \(fromSeq)-\(actualToSeq)")
    }

    // Get latest motion data (called from Capacitor plugin)
    func getLatestMotionData() -> [String: Any] {
        return latestMotionData
    }

    // Check if Watch is connected
    var isWatchReachable: Bool {
        return WCSession.default.isReachable
    }

    // MARK: - Send Commands to Watch

    func sendStartCommand(sessionId: String?, plannedDuration: Int? = nil, completion: @escaping (Bool, String?) -> Void) {
        guard WCSession.default.activationState == .activated else {
            completion(false, "WatchConnectivity not activated")
            return
        }

        guard WCSession.default.isReachable else {
            completion(false, "Watch not reachable")
            return
        }

        var message: [String: Any] = [
            "type": "command",
            "command": "START",
            "sessionId": sessionId ?? "",
            "timestamp": Date().timeIntervalSince1970
        ]

        // Include planned duration if provided (in minutes)
        if let duration = plannedDuration {
            message["plannedDuration"] = duration
        }

        print("📱 Sending START command to Watch...")
        print("   - Session ID: \(sessionId ?? "none")")
        print("   - Planned Duration: \(plannedDuration ?? 0) min")

        WCSession.default.sendMessage(message, replyHandler: { reply in
            print("✅ Watch acknowledged START command: \(reply)")
            completion(true, nil)
        }) { error in
            print("❌ Failed to send START command: \(error.localizedDescription)")
            completion(false, error.localizedDescription)
        }
    }

    func sendStopCommand(completion: @escaping (Bool, String?) -> Void) {
        guard WCSession.default.activationState == .activated else {
            completion(false, "WatchConnectivity not activated")
            return
        }

        guard WCSession.default.isReachable else {
            completion(false, "Watch not reachable")
            return
        }

        let message: [String: Any] = [
            "type": "command",
            "command": "STOP",
            "timestamp": Date().timeIntervalSince1970
        ]

        print("📱 Sending STOP command to Watch...")

        WCSession.default.sendMessage(message, replyHandler: { reply in
            print("✅ Watch acknowledged STOP command: \(reply)")
            completion(true, nil)
        }) { error in
            print("❌ Failed to send STOP command: \(error.localizedDescription)")
            completion(false, error.localizedDescription)
        }
    }

    // MARK: - Calibration Commands

    func sendCalibrationCommand(
        type: String,
        countdown: Int? = nil,
        progress: Int? = nil,
        maxForce: Double? = nil,
        message: String? = nil,
        sessionId: String? = nil,
        completion: @escaping (Bool, String?) -> Void
    ) {
        guard WCSession.default.activationState == .activated else {
            completion(false, "WatchConnectivity not activated")
            return
        }

        guard WCSession.default.isReachable else {
            completion(false, "Watch not reachable")
            return
        }

        var commandMessage: [String: Any] = [
            "type": "calibration",
            "command": type,
            "timestamp": Date().timeIntervalSince1970
        ]

        if let countdown = countdown {
            commandMessage["countdown"] = countdown
        }
        if let progress = progress {
            commandMessage["progress"] = progress
        }
        if let maxForce = maxForce {
            commandMessage["maxForce"] = maxForce
        }
        if let message = message {
            commandMessage["message"] = message
        }
        if let sessionId = sessionId {
            commandMessage["sessionId"] = sessionId
        }

        print("📱 Sending calibration command to Watch: \(type)")

        // Fire-and-forget: don't wait for Watch reply to avoid blocking calibration UI
        // The Watch will update its UI immediately upon receiving the message
        WCSession.default.sendMessage(commandMessage, replyHandler: nil) { error in
            // Only log errors, don't fail the calibration flow
            print("⚠️ Calibration command send error (non-blocking): \(error.localizedDescription)")
        }

        // Immediately report success - Watch will handle the command
        completion(true, nil)
    }

    func sendEnableRecordingControlCommand(sessionId: String, completion: @escaping (Bool, String?) -> Void) {
        sendCalibrationCommand(
            type: "ENABLE_RECORDING_CONTROL",
            sessionId: sessionId,
            completion: completion
        )
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("❌ WatchConnectivity failed: \(error.localizedDescription)")
        } else {
            print("✅ WatchConnectivity ready: \(activationState.rawValue)")
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {
        print("⚠️ Session inactive")
    }

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        print("📡 Watch reachability changed: \(session.isReachable ? "CONNECTED ✅" : "DISCONNECTED ❌")")
        print("   - isPaired: \(session.isPaired)")
        print("   - isWatchAppInstalled: \(session.isWatchAppInstalled)")
    }

    // Handle application context updates (more reliable during workout sessions)
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        print("📱🚨 Received applicationContext from Watch: \(applicationContext)")

        guard let type = applicationContext["type"] as? String else {
            print("⚠️ applicationContext missing type")
            return
        }

        switch type {
        case "recording_control":
            if let action = applicationContext["action"] as? String {
                print("📱🚨 Received recording control via applicationContext from Watch: \(action)")
                DispatchQueue.main.async { [weak self] in
                    self?.onRecordingControl?(action)
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchRecordingControl"),
                        object: nil,
                        userInfo: ["action": action]
                    )
                }
            }

        default:
            print("⚠️ Unknown applicationContext type: \(type)")
        }
    }
}
