//
//  WatchMotionPlugin.swift
//  App
//

import Capacitor
import Foundation
import WatchConnectivity

@objc(WatchMotionPlugin)
public class WatchMotionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchMotionPlugin"
    public let jsName = "WatchMotion"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isWatchConnected", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMotionData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getConnectionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ping", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise),
        // Recording control methods
        CAPPluginMethod(name: "startWatchRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopWatchRecording", returnType: CAPPluginReturnPromise),
        // Calibration methods
        CAPPluginMethod(name: "sendCalibrationCommand", returnType: CAPPluginReturnPromise),
        // Audio methods
        CAPPluginMethod(name: "setAudioMuted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAudioStatus", returnType: CAPPluginReturnPromise),
        // Motion batch methods (100Hz binary streaming)
        CAPPluginMethod(name: "resetMotionBatchTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMotionBatchStats", returnType: CAPPluginReturnPromise)
    ]

    private var motionCallId: String?

    override public func load() {
        NSLog("🔌 WatchMotionPlugin.load() CALLED")

        // Initialize WatchConnectivityManager to ensure session is activated
        _ = WatchConnectivityManager.shared

        NSLog("🔌 WatchMotionPlugin loaded - setting up callback")

        // Register callback with the manager to receive motion data directly (legacy JSON format)
        WatchConnectivityManager.shared.setMotionDataCallback { [weak self] data in
            guard let self = self else { return }
            // Debug logging disabled for performance - was blocking at 100Hz
            if self.hasListeners("motionData") {
                self.notifyListeners("motionData", data: data)
            }
        }

        // Register callback for motion batch data (new 100Hz binary format)
        WatchConnectivityManager.shared.setMotionBatchCallback { [weak self] samples, sessionId in
            guard let self = self else { return }
            if self.hasListeners("motionBatch") {
                self.notifyListeners("motionBatch", data: [
                    "samples": samples,
                    "sessionId": sessionId,
                    "timestamp": Date().timeIntervalSince1970
                ])
            }
        }

        // Register callback for audio data
        WatchConnectivityManager.shared.setAudioDataCallback { [weak self] audioData, dbLevel in
            guard let self = self else { return }
            let hasListeners = self.hasListeners("audioData")
            if hasListeners {
                self.notifyListeners("audioData", data: [
                    "dbLevel": dbLevel,
                    "timestamp": Date().timeIntervalSince1970,
                    "isReceiving": AudioPlaybackManager.shared.isReceiving
                ])
            }
        }

        // Register callback for recording control messages from Watch
        WatchConnectivityManager.shared.setRecordingControlCallback { [weak self] action in
            guard let self = self else {
                print("🎮⚠️ WatchMotionPlugin: Recording control callback - self is nil!")
                return
            }
            let hasListeners = self.hasListeners("recordingControl")
            print("🎮🚨🚨🚨 WatchMotionPlugin: Recording control received from Watch!")
            print("🎮   - action: \(action)")
            print("🎮   - hasListeners: \(hasListeners)")

            if hasListeners {
                print("🎮 Emitting 'recordingControl' event to JS...")
                self.notifyListeners("recordingControl", data: [
                    "action": action,
                    "timestamp": Date().timeIntervalSince1970
                ])
                print("🎮 'recordingControl' event emitted successfully")
            } else {
                print("🎮⚠️ No JS listeners registered for 'recordingControl' - event NOT emitted!")
            }
        }

        // Register callback for pain notes from Watch
        WatchConnectivityManager.shared.setPainNoteCallback { [weak self] painNote in
            guard let self = self else { return }
            let hasListeners = self.hasListeners("painNote")
            print("📝 WatchMotionPlugin: Pain note callback received, hasListeners=\(hasListeners)")
            if hasListeners {
                // Extract pain note data
                var data: [String: Any] = [
                    "timestamp": Date().timeIntervalSince1970
                ]

                if let id = painNote["id"] as? String {
                    data["id"] = id
                }
                if let relativeTimeMs = painNote["relativeTimeMs"] as? Int64 {
                    data["relativeTimeMs"] = relativeTimeMs
                }
                if let text = painNote["text"] as? String {
                    data["text"] = text
                }
                if let painLevel = painNote["painLevel"] as? Int {
                    data["painLevel"] = painLevel
                }

                self.notifyListeners("painNote", data: data)
                print("📝 WatchMotionPlugin: Emitted painNote event - id: \(data["id"] ?? "unknown")")
            }
        }

        // Also listen via NotificationCenter as backup
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMotionData(_:)),
            name: NSNotification.Name("WatchMotionDataReceived"),
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // Called when Watch sends motion data
    @objc func handleMotionData(_ notification: Notification) {
        guard let data = notification.userInfo as? [String: Any] else {
            return
        }

        // Debug logging disabled for performance
        if hasListeners("motionData") {
            notifyListeners("motionData", data: data)
        }
    }

    // Called by JS to signal it's ready to receive events - also sends cached data
    @objc func startListening(_ call: CAPPluginCall) {
        NSLog("🎧 WatchMotionPlugin.startListening() CALLED")

        // Send any cached data immediately
        let cachedData = WatchConnectivityManager.shared.getLatestMotionData()
        NSLog("🎧 Cached data keys: \(cachedData.keys)")
        if !cachedData.isEmpty {
            NSLog("📤 Sending cached motion data to new listener")
            notifyListeners("motionData", data: cachedData)
        }

        call.resolve(["status": "listening"])
    }

    // Get latest motion data (one-time fetch)
    @objc func getMotionData(_ call: CAPPluginCall) {
        let data = WatchConnectivityManager.shared.getLatestMotionData()

        if data.isEmpty {
            call.resolve(["available": false])
        } else {
            print("📊 Returning motion data: \(data.keys)")
            call.resolve(data)
        }
    }

    // Check if Watch is connected
    @objc func isWatchConnected(_ call: CAPPluginCall) {
//        NSLog("🔍 WatchMotionPlugin.isWatchConnected called")
        let connected = WatchConnectivityManager.shared.isWatchReachable
//        NSLog("🔍 Watch connected check: \(connected)")
        call.resolve(["connected": connected])
    }
    
    // Debug method to check connectivity status
    @objc func getConnectionStatus(_ call: CAPPluginCall) {
        let session = WCSession.default
        let status: [String: Any] = [
            "isSupported": WCSession.isSupported(),
            "isPaired": session.isPaired,
            "isWatchAppInstalled": session.isWatchAppInstalled,
            "isReachable": session.isReachable,
            "activationState": session.activationState.rawValue
        ]
        print("📊 Connection status: \(status)")
        call.resolve(status)
    }

    // Simple ping to trigger plugin load
    @objc func ping(_ call: CAPPluginCall) {
        print("🏓 WatchMotionPlugin: ping received")
        call.resolve(["status": "ok"])
    }

    // MARK: - Audio Methods

    // Set audio muted state
    @objc func setAudioMuted(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        AudioPlaybackManager.shared.isMuted = muted
        print("🔊 WatchMotionPlugin: setAudioMuted(\(muted))")
        call.resolve(["muted": muted])
    }

    // Get current audio status
    @objc func getAudioStatus(_ call: CAPPluginCall) {
        let status = AudioPlaybackManager.shared.getStatus()
        print("🔊 WatchMotionPlugin: getAudioStatus -> \(status)")
        call.resolve(status)
    }

    // MARK: - Recording Control Methods

    // Start recording on Watch
    @objc func startWatchRecording(_ call: CAPPluginCall) {
        let sessionId = call.getString("sessionId")
        let plannedDuration = call.getInt("plannedDuration") // Duration in minutes

        print("🎬 WatchMotionPlugin: startWatchRecording called with sessionId: \(sessionId ?? "none"), plannedDuration: \(plannedDuration ?? 0) min")

        WatchConnectivityManager.shared.sendStartCommand(sessionId: sessionId, plannedDuration: plannedDuration) { success, error in
            if success {
                print("✅ WatchMotionPlugin: Successfully sent START command to Watch")
                call.resolve(["success": true])
            } else {
                print("❌ WatchMotionPlugin: Failed to send START command: \(error ?? "unknown error")")
                call.resolve([
                    "success": false,
                    "error": error ?? "Failed to send START command to Watch"
                ])
            }
        }
    }

    // Stop recording on Watch
    @objc func stopWatchRecording(_ call: CAPPluginCall) {
        print("🛑 WatchMotionPlugin: stopWatchRecording called")

        WatchConnectivityManager.shared.sendStopCommand { success, error in
            if success {
                print("✅ WatchMotionPlugin: Successfully sent STOP command to Watch")
                call.resolve(["success": true])
            } else {
                print("❌ WatchMotionPlugin: Failed to send STOP command: \(error ?? "unknown error")")
                call.resolve([
                    "success": false,
                    "error": error ?? "Failed to send STOP command to Watch"
                ])
            }
        }
    }

    // MARK: - Calibration Methods

    // Send calibration command to Watch
    @objc func sendCalibrationCommand(_ call: CAPPluginCall) {
        guard let type = call.getString("type") else {
            call.reject("Missing required parameter: type")
            return
        }

        let countdown = call.getInt("countdown")
        let progress = call.getInt("progress")
        let maxForce = call.getDouble("maxForce")
        let message = call.getString("message")
        let sessionId = call.getString("sessionId")

        print("🎯 WatchMotionPlugin: sendCalibrationCommand called - type: \(type)")

        WatchConnectivityManager.shared.sendCalibrationCommand(
            type: type,
            countdown: countdown,
            progress: progress,
            maxForce: maxForce,
            message: message,
            sessionId: sessionId
        ) { success, error in
            if success {
                print("✅ WatchMotionPlugin: Successfully sent calibration command: \(type)")
                call.resolve(["success": true])
            } else {
                print("❌ WatchMotionPlugin: Failed to send calibration command: \(error ?? "unknown error")")
                call.resolve([
                    "success": false,
                    "error": error ?? "Failed to send calibration command to Watch"
                ])
            }
        }
    }

    // MARK: - Motion Batch Methods (100Hz Binary Streaming)

    // Reset motion batch sequence tracking (call when starting a new recording)
    @objc func resetMotionBatchTracking(_ call: CAPPluginCall) {
        print("📊 WatchMotionPlugin: resetMotionBatchTracking called")
        WatchConnectivityManager.shared.resetSequenceTracking()
        call.resolve(["success": true])
    }

    // Get motion batch statistics for debugging
    @objc func getMotionBatchStats(_ call: CAPPluginCall) {
        let stats = WatchConnectivityManager.shared.getMotionBatchStats()
        print("📊 WatchMotionPlugin: getMotionBatchStats -> \(stats)")
        call.resolve(stats)
    }
}
