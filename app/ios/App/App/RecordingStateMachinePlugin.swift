//
//  RecordingStateMachinePlugin.swift
//  App
//
//  Capacitor plugin exposing RecordingStateMachine to JavaScript
//

import Capacitor
import Foundation

@objc(RecordingStateMachinePlugin)
public class RecordingStateMachinePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RecordingStateMachinePlugin"
    public let jsName = "RecordingStateMachine"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestStop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeError", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forceReset", returnType: CAPPluginReturnPromise)
    ]

    private let stateMachine = RecordingStateMachine.shared

    override public func load() {
        NSLog("🔌 RecordingStateMachinePlugin: load() called")

        // Register for state change notifications
        stateMachine.setStateChangeCallback { [weak self] change in
            guard let self = self else { return }

            NSLog("🔌 RecordingStateMachinePlugin: State changed - emitting event")

            // Emit event to JavaScript
            self.notifyListeners("stateChanged", data: change.toDictionary())
        }

        NSLog("🔌 RecordingStateMachinePlugin: Loaded and ready")
    }

    // MARK: - Plugin Methods

    /// Get current state and context
    @objc func getState(_ call: CAPPluginCall) {
        NSLog("🔌 RecordingStateMachinePlugin: getState()")

        let stateInfo = stateMachine.getStateInfo()
        call.resolve(stateInfo)
    }

    /// Request to start recording
    @objc func requestStart(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId") else {
            call.reject("sessionId is required")
            return
        }

        let arduinoDeviceId = call.getString("arduinoDeviceId")
        let plannedDuration = call.getInt("plannedDuration") ?? 30
        let startedByString = call.getString("startedBy") ?? "phone"

        let startedBy: RecordingStartedBy
        switch startedByString {
        case "watch":
            startedBy = .watch
        case "phone":
            startedBy = .phone
        default:
            startedBy = .unknown
        }

        NSLog("🔌 RecordingStateMachinePlugin: requestStart(sessionId: \(sessionId), duration: \(plannedDuration)min, startedBy: \(startedByString))")

        stateMachine.requestStart(
            sessionId: sessionId,
            arduinoDeviceId: arduinoDeviceId,
            plannedDuration: plannedDuration,
            startedBy: startedBy
        ) { success, error in
            if success {
                call.resolve([
                    "success": true,
                    "state": self.stateMachine.state.stringValue
                ])
            } else {
                call.resolve([
                    "success": false,
                    "error": error ?? "Unknown error",
                    "state": self.stateMachine.state.stringValue
                ])
            }
        }
    }

    /// Request to stop recording
    @objc func requestStop(_ call: CAPPluginCall) {
        NSLog("🔌 RecordingStateMachinePlugin: requestStop()")

        stateMachine.requestStop { success, error, resultData in
            var response: [String: Any] = [
                "success": success,
                "state": self.stateMachine.state.stringValue
            ]

            if let error = error {
                response["error"] = error
            }

            if let resultData = resultData {
                response["result"] = resultData
            }

            call.resolve(response)
        }
    }

    /// Acknowledge and clear error state
    @objc func acknowledgeError(_ call: CAPPluginCall) {
        NSLog("🔌 RecordingStateMachinePlugin: acknowledgeError()")

        stateMachine.acknowledgeError()

        call.resolve([
            "success": true,
            "state": stateMachine.state.stringValue
        ])
    }

    /// Force reset to idle state (for recovery)
    @objc func forceReset(_ call: CAPPluginCall) {
        NSLog("🔌 RecordingStateMachinePlugin: forceReset()")

        stateMachine.forceReset()

        call.resolve([
            "success": true,
            "state": stateMachine.state.stringValue
        ])
    }
}
