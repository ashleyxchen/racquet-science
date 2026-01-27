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
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise)
    ]

    private var motionCallId: String?

    override public func load() {
        NSLog("🔌 WatchMotionPlugin.load() CALLED")

        // Initialize WatchConnectivityManager to ensure session is activated
        _ = WatchConnectivityManager.shared

        NSLog("🔌 WatchMotionPlugin loaded - setting up callback")

        // Register callback with the manager to receive data directly
        WatchConnectivityManager.shared.setMotionDataCallback { [weak self] data in
            guard let self = self else { return }
            let hasListeners = self.hasListeners("motionData")
            print("🎯 WatchMotionPlugin: Received data via callback, hasListeners=\(hasListeners)")
            if hasListeners {
                self.notifyListeners("motionData", data: data)
            } else {
                print("⚠️ No JS listeners registered yet, data not forwarded")
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
            print("⚠️ WatchMotionPlugin: No data in notification")
            return
        }

        let hasListeners = self.hasListeners("motionData")
        print("🎯 WatchMotionPlugin: Broadcasting motion data to JavaScript listeners, hasListeners=\(hasListeners)")

        if hasListeners {
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
        NSLog("🔍 WatchMotionPlugin.isWatchConnected called")
        let connected = WatchConnectivityManager.shared.isWatchReachable
        NSLog("🔍 Watch connected check: \(connected)")
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
}
