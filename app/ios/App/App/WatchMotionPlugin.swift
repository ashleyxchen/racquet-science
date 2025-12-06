//
//  WatchMotionPlugin.swift
//  App
//

import Capacitor
import Foundation

@objc(WatchMotionPlugin)
public class WatchMotionPlugin: CAPPlugin {

    private var motionCallId: String?

    override public func load() {
        // Listen for motion data updates
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
        guard let data = notification.userInfo as? [String: Any] else { return }

        // Send to JavaScript listeners
        notifyListeners("motionData", data: data)
    }

    // Get latest motion data (one-time fetch)
    @objc func getMotionData(_ call: CAPPluginCall) {
        let data = WatchConnectivityManager.shared.getLatestMotionData()

        if data.isEmpty {
            call.resolve(["available": false])
        } else {
            call.resolve(data)
        }
    }

    // Check if Watch is connected
    @objc func isWatchConnected(_ call: CAPPluginCall) {
        let connected = WatchConnectivityManager.shared.isWatchReachable
        call.resolve(["connected": connected])
    }
}
