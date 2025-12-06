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

    private override init() {
        super.init()

        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
            print("📱 iOS WatchConnectivity activated")
        }
    }

    // MARK: - Receive Motion Data from Watch

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        if let type = message["type"] as? String, type == "motion_data" {
            // Store latest data
            latestMotionData = message

            // Notify listeners (Capacitor plugin)
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("WatchMotionDataReceived"),
                    object: nil,
                    userInfo: message
                )
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
        print("📡 Watch \(session.isReachable ? "connected" : "disconnected")")
    }
}
