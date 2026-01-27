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

    // Callback for forwarding data to plugin
    private var onMotionData: (([String: Any]) -> Void)?

    // Register callback to receive data directly
    func setMotionDataCallback(_ callback: @escaping ([String: Any]) -> Void) {
        self.onMotionData = callback
        print("📱 WatchConnectivityManager: Callback registered")

        // If we already have data, send it immediately
        if !latestMotionData.isEmpty {
            print("📱 WatchConnectivityManager: Sending cached data via callback")
            callback(latestMotionData)
        }
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
        print("📥 Received message from Watch (with reply): \(message)")
        print("\(message.keys)")
        print("\(message)")


        if let type = message["type"] as? String, type == "motion_data" {
            // Store latest data
            latestMotionData = message
            print("✅ Motion data stored")

            // Forward directly to plugin if registered
            DispatchQueue.main.async { [weak self] in
                if let callback = self?.onMotionData {
                    print("✅ Forwarding via callback")
                    callback(message)
                } else {
                    print("⚠️ Plugin not registered yet, posting notification")
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchMotionDataReceived"),
                        object: nil,
                        userInfo: message
                    )
                }
            }

            // Send acknowledgment back to Watch
            replyHandler(["status": "received"])
        } else {
            print("⚠️ Received message but type is not 'motion_data'")
            replyHandler(["status": "ignored"])
        }
    }
    
    // Also handle messages without reply handler (just in case)
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        print("📥 Received message from Watch (no reply): \(message.keys)")

        print("📥 Message content: \(message)")

        if let type = message["type"] as? String, type == "motion_data" {
            // Store latest data
            latestMotionData = message
            print("✅ Motion data stored")

            // Forward directly to plugin if registered
            DispatchQueue.main.async { [weak self] in
                if let callback = self?.onMotionData {
                    print("✅ Forwarding via callback")
                    callback(message)
                } else {
                    print("⚠️ Plugin not registered yet, posting notification")
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchMotionDataReceived"),
                        object: nil,
                        userInfo: message
                    )
                }
            }
        } else {
            print("⚠️ Received message but type is not 'motion_data'")
        }
    }
    
    // Receive background transfers (more reliable than sendMessage)
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        print("📦 Received userInfo from Watch: \(userInfo.keys)")

        if let type = userInfo["type"] as? String, type == "motion_data" {
            // Store latest data
            latestMotionData = userInfo
            print("✅ Motion data stored (from userInfo)")

            // Forward directly via callback if registered
            DispatchQueue.main.async { [weak self] in
                if let callback = self?.onMotionData {
                    print("✅ Forwarding via callback (userInfo)")
                    callback(userInfo)
                } else {
                    print("⚠️ Callback not registered yet, posting notification")
                    NotificationCenter.default.post(
                        name: NSNotification.Name("WatchMotionDataReceived"),
                        object: nil,
                        userInfo: userInfo
                    )
                }
            }
        }
    }

    // Get latest motion data (called from Capacitor plugin)
    func getLatestMotionData() -> [String: Any] {
        return latestMotionData
    }

    // Check if Watch is connected
    var isWatchReachable: Bool {
        return WCSession.default.isReachable
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
}
