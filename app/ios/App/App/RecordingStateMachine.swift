//
//  RecordingStateMachine.swift
//  App
//
//  Core state machine for recording orchestration - SINGLE SOURCE OF TRUTH
//  All recording state flows through this class.
//

import Foundation
import WatchConnectivity

// MARK: - Recording State Enum

/// The possible states of the recording state machine
@objc public enum RecordingState: Int, CustomStringConvertible {
    case idle = 0
    case starting = 1
    case recording = 2
    case stopping = 3
    case error = 4

    public var description: String {
        switch self {
        case .idle: return "idle"
        case .starting: return "starting"
        case .recording: return "recording"
        case .stopping: return "stopping"
        case .error: return "error"
        }
    }

    public var stringValue: String { description }
}

/// Who initiated the recording
@objc public enum RecordingStartedBy: Int {
    case phone = 0
    case watch = 1
    case unknown = 2

    public var stringValue: String {
        switch self {
        case .phone: return "phone"
        case .watch: return "watch"
        case .unknown: return "unknown"
        }
    }
}

// MARK: - Recording Context

/// Context data associated with the current recording
public struct RecordingContext {
    public var sessionId: String?
    public var startTime: Date?
    public var plannedDuration: Int // minutes
    public var startedBy: RecordingStartedBy
    public var arduinoDeviceId: String?

    // Sensor readiness flags
    public var videoReady: Bool = false
    public var watchReady: Bool = false
    public var watchAcknowledged: Bool = false  // True if Watch actually received the start command
    public var arduinoReady: Bool = false

    // Error tracking
    public var errorMessage: String?
    public var errorTimestamp: Date?

    // Result data (populated on stop)
    public var videoPath: String?
    public var videoDurationMs: Int?

    public init() {
        self.plannedDuration = 30
        self.startedBy = .unknown
    }

    public func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "plannedDuration": plannedDuration,
            "startedBy": startedBy.stringValue,
            "videoReady": videoReady,
            "watchReady": watchReady,
            "watchAcknowledged": watchAcknowledged,
            "arduinoReady": arduinoReady
        ]

        if let sessionId = sessionId {
            dict["sessionId"] = sessionId
        }
        if let startTime = startTime {
            dict["startTime"] = startTime.timeIntervalSince1970 * 1000 // ms
        }
        if let errorMessage = errorMessage {
            dict["errorMessage"] = errorMessage
        }
        if let videoPath = videoPath {
            dict["videoPath"] = videoPath
        }
        if let videoDurationMs = videoDurationMs {
            dict["videoDurationMs"] = videoDurationMs
        }
        if let arduinoDeviceId = arduinoDeviceId {
            dict["arduinoDeviceId"] = arduinoDeviceId
        }

        return dict
    }
}

// MARK: - State Change Event

/// Event emitted when state changes
public struct RecordingStateChange {
    public let previousState: RecordingState
    public let newState: RecordingState
    public let context: RecordingContext
    public let timestamp: Date

    public func toDictionary() -> [String: Any] {
        return [
            "previousState": previousState.stringValue,
            "state": newState.stringValue,
            "context": context.toDictionary(),
            "timestamp": timestamp.timeIntervalSince1970 * 1000
        ]
    }
}

// MARK: - State Machine Delegate

public protocol RecordingStateMachineDelegate: AnyObject {
    func recordingStateMachine(_ machine: RecordingStateMachine, didChangeState change: RecordingStateChange)
}

// MARK: - Recording State Machine

/// Central state machine for recording orchestration
/// This is the SINGLE SOURCE OF TRUTH for recording state
public class RecordingStateMachine {

    // MARK: - Singleton

    public static let shared = RecordingStateMachine()

    // MARK: - Properties

    private(set) public var state: RecordingState = .idle {
        didSet {
            if oldValue != state {
                let change = RecordingStateChange(
                    previousState: oldValue,
                    newState: state,
                    context: context,
                    timestamp: Date()
                )
                notifyStateChange(change)
            }
        }
    }

    private(set) public var context = RecordingContext()

    public weak var delegate: RecordingStateMachineDelegate?

    // State change callback for Capacitor plugin
    private var onStateChange: ((RecordingStateChange) -> Void)?

    // Timers for timeout handling
    private var startTimeoutTimer: Timer?
    private var stopTimeoutTimer: Timer?
    private var errorAutoAcknowledgeTimer: Timer?
    private var watchdogTimer: Timer?

    // Constants
    private let startTimeoutSeconds: TimeInterval = 3.0  // Reduced from 5.0 for faster feedback
    private let stopTimeoutSeconds: TimeInterval = 5.0   // Force cleanup if stop hangs
    private let errorAutoAcknowledgeSeconds: TimeInterval = 10.0  // Auto-recover from error state
    private let minimumRecordingMs: Int = 3000 // 3 seconds
    private let watchdogIntervalSeconds: TimeInterval = 30.0

    // Thread safety
    private let stateQueue = DispatchQueue(label: "com.app.recordingStateMachine", qos: .userInteractive)

    // MARK: - Initialization

    private init() {
        NSLog("📍 RecordingStateMachine: Initialized")
    }

    // MARK: - Public API

    /// Register callback for state changes (used by Capacitor plugin)
    public func setStateChangeCallback(_ callback: @escaping (RecordingStateChange) -> Void) {
        onStateChange = callback
    }

    /// Get current state and context as dictionary
    public func getStateInfo() -> [String: Any] {
        return [
            "state": state.stringValue,
            "context": context.toDictionary()
        ]
    }

    /// Request to start recording
    /// - Parameters:
    ///   - sessionId: Unique session identifier
    ///   - arduinoDeviceId: Optional BLE device ID for Arduino
    ///   - plannedDuration: Planned duration in minutes
    ///   - startedBy: Who initiated the recording (phone or watch)
    ///   - completion: Called with success/failure
    public func requestStart(
        sessionId: String,
        arduinoDeviceId: String? = nil,
        plannedDuration: Int = 30,
        startedBy: RecordingStartedBy = .phone,
        completion: @escaping (Bool, String?) -> Void
    ) {
        stateQueue.async { [weak self] in
            guard let self = self else { return }

            NSLog("📍 RecordingStateMachine: requestStart - current state: \(self.state), sessionId: \(sessionId)")

            // Validate state transition
            guard self.state == .idle else {
                let errorMsg = "Cannot start: current state is \(self.state)"
                NSLog("📍❌ RecordingStateMachine: \(errorMsg)")
                DispatchQueue.main.async { completion(false, errorMsg) }
                return
            }

            // Initialize context
            self.context = RecordingContext()
            self.context.sessionId = sessionId
            self.context.arduinoDeviceId = arduinoDeviceId
            self.context.plannedDuration = plannedDuration
            self.context.startedBy = startedBy
            self.context.videoReady = false
            self.context.watchReady = false
            self.context.arduinoReady = arduinoDeviceId == nil // No Arduino = already "ready"

            // Transition to STARTING
            DispatchQueue.main.async {
                self.state = .starting
                NSLog("📍 RecordingStateMachine: State → STARTING")

                // Start timeout timer
                self.startStartTimeoutTimer()

                // Begin sensor orchestration
                self.startSensors(completion: completion)
            }
        }
    }

    /// Request to stop recording
    /// - Parameter completion: Called with success/failure and optional video path
    public func requestStop(completion: @escaping (Bool, String?, [String: Any]?) -> Void) {
        stateQueue.async { [weak self] in
            guard let self = self else { return }

            NSLog("📍 RecordingStateMachine: requestStop - current state: \(self.state)")

            // Validate state transition
            guard self.state == .recording else {
                let errorMsg = "Cannot stop: current state is \(self.state)"
                NSLog("📍❌ RecordingStateMachine: \(errorMsg)")
                DispatchQueue.main.async { completion(false, errorMsg, nil) }
                return
            }

            // Check minimum duration
            if let startTime = self.context.startTime {
                let elapsedMs = Int(Date().timeIntervalSince(startTime) * 1000)
                if elapsedMs < self.minimumRecordingMs {
                    let remainingMs = self.minimumRecordingMs - elapsedMs
                    let errorMsg = "Recording too short. Wait \(remainingMs)ms more."
                    NSLog("📍⏳ RecordingStateMachine: \(errorMsg)")
                    DispatchQueue.main.async { completion(false, errorMsg, nil) }
                    return
                }
            }

            // Transition to STOPPING
            DispatchQueue.main.async {
                self.state = .stopping
                NSLog("📍 RecordingStateMachine: State → STOPPING")

                // Stop all sensors
                self.stopSensors(completion: completion)
            }
        }
    }

    /// Acknowledge and clear error state
    public func acknowledgeError() {
        stateQueue.async { [weak self] in
            guard let self = self else { return }

            guard self.state == .error else {
                NSLog("📍 RecordingStateMachine: acknowledgeError called but state is \(self.state)")
                return
            }

            DispatchQueue.main.async {
                self.cancelErrorAutoAcknowledgeTimer()
                self.context.errorMessage = nil
                self.context.errorTimestamp = nil
                self.state = .idle
                NSLog("📍 RecordingStateMachine: Error acknowledged, State → IDLE")
            }
        }
    }

    /// Force reset to idle state (for recovery)
    public func forceReset() {
        stateQueue.async { [weak self] in
            guard let self = self else { return }

            NSLog("📍⚠️ RecordingStateMachine: forceReset called from state \(self.state)")

            DispatchQueue.main.async {
                // Cancel ALL timers
                self.cancelStartTimeoutTimer()
                self.cancelStopTimeoutTimer()
                self.cancelErrorAutoAcknowledgeTimer()
                self.cancelWatchdogTimer()

                // Reset context
                self.context = RecordingContext()

                // Force state to idle
                self.state = .idle
                NSLog("📍 RecordingStateMachine: Force reset complete, State → IDLE")
            }
        }
    }

    // MARK: - Sensor Orchestration

    private func startSensors(completion: @escaping (Bool, String?) -> Void) {
        NSLog("📍 RecordingStateMachine: Starting sensors...")

        guard let sessionId = context.sessionId else {
            transitionToError("No session ID")
            completion(false, "No session ID")
            return
        }

        // Step 1: Start video FIRST (takes longest)
        NSLog("📍 [1/3] Starting video recording...")
        VideoRecordingManager.shared.startRecording(sessionId: sessionId) { [weak self] success in
            guard let self = self else { return }

            DispatchQueue.main.async {
                if success {
                    self.context.videoReady = true
                    NSLog("📍✅ Video ready")
                    self.checkAllSensorsReady(completion: completion)
                } else {
                    let errorMsg = "Video recording failed to start"
                    NSLog("📍❌ \(errorMsg)")
                    self.transitionToError(errorMsg)
                    completion(false, errorMsg)
                }
            }
        }

        // Step 2: Start Watch recording with retry (parallel with video)
        NSLog("📍 [2/3] Starting Watch recording...")
        self.sendWatchStartCommandWithRetry(sessionId: sessionId, maxRetries: 3) { [weak self] readyToProceed, acknowledged in
            guard let self = self else { return }

            DispatchQueue.main.async {
                self.context.watchReady = readyToProceed
                self.context.watchAcknowledged = acknowledged
                if acknowledged {
                    NSLog("📍✅ Watch ready and acknowledged")
                } else {
                    NSLog("📍⚠️ Watch ready but NOT acknowledged - recording may not show on watch")
                }
                self.checkAllSensorsReady(completion: completion)
            }
        }

        // Step 3: Arduino is handled by React layer via BLE
        // Mark as ready if no Arduino device ID was provided
        if context.arduinoDeviceId == nil {
            context.arduinoReady = true
            NSLog("📍 [3/3] No Arduino device, skipping")
        } else {
            // Arduino will be started by React via BLE notifications
            // For now, mark as ready - React handles the actual BLE setup
            context.arduinoReady = true
            NSLog("📍 [3/3] Arduino device \(context.arduinoDeviceId!) - React handles BLE setup")
        }

        checkAllSensorsReady(completion: completion)
    }

    private func checkAllSensorsReady(completion: @escaping (Bool, String?) -> Void) {
        NSLog("📍 RecordingStateMachine: Checking sensors - video:\(context.videoReady) watch:\(context.watchReady) arduino:\(context.arduinoReady)")

        guard context.videoReady && context.watchReady && context.arduinoReady else {
            return // Not all ready yet
        }

        // All sensors ready - transition to RECORDING
        guard state == .starting else {
            NSLog("📍⚠️ All sensors ready but state is \(state), not transitioning")
            return
        }

        cancelStartTimeoutTimer()

        context.startTime = Date()
        state = .recording

        NSLog("📍✅ RecordingStateMachine: All sensors ready, State → RECORDING")

        // Start watchdog timer for stuck state detection
        startWatchdogTimer()

        // Broadcast state to Watch
        broadcastStateToWatch()

        completion(true, nil)
    }

    /// Send Watch start command with automatic retry on failure
    private func sendWatchStartCommandWithRetry(
        sessionId: String,
        maxRetries: Int,
        attempt: Int = 1,
        completion: @escaping (Bool, Bool) -> Void  // (readyToProceed, acknowledged)
    ) {
        WatchConnectivityManager.shared.sendStartCommand(
            sessionId: sessionId,
            plannedDuration: context.plannedDuration
        ) { [weak self] success, error in
            if success {
                completion(true, true)
            } else if attempt < maxRetries {
                NSLog("📍⚠️ RecordingStateMachine: Watch start attempt \(attempt) failed, retrying...")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self?.sendWatchStartCommandWithRetry(
                        sessionId: sessionId,
                        maxRetries: maxRetries,
                        attempt: attempt + 1,
                        completion: completion
                    )
                }
            } else {
                NSLog("📍⚠️ RecordingStateMachine: Watch start failed after \(maxRetries) attempts: \(error ?? "unknown")")
                // Still ready to proceed, but not acknowledged
                completion(true, false)
            }
        }
    }

    private func stopSensors(completion: @escaping (Bool, String?, [String: Any]?) -> Void) {
        NSLog("📍 RecordingStateMachine: Stopping sensors...")

        // Start stop timeout timer
        startStopTimeoutTimer(completion: completion)

        let dispatchGroup = DispatchGroup()
        var errors: [String] = []

        // Stop video recording
        dispatchGroup.enter()
        NSLog("📍 [1/3] Stopping video...")
        VideoRecordingManager.shared.stopRecordingAsync { [weak self] result in
            switch result {
            case .success(let (url, durationMs)):
                self?.context.videoPath = url.path
                self?.context.videoDurationMs = durationMs
                NSLog("📍✅ Video stopped: \(url.path), duration: \(durationMs)ms")
            case .failure(let error):
                errors.append("Video: \(error.localizedDescription)")
                NSLog("📍❌ Video stop failed: \(error.localizedDescription)")
            }
            dispatchGroup.leave()
        }

        // Stop Watch recording
        dispatchGroup.enter()
        NSLog("📍 [2/3] Stopping Watch...")
        WatchConnectivityManager.shared.sendStopCommand { success, error in
            if !success {
                errors.append("Watch: \(error ?? "unknown")")
                NSLog("📍⚠️ Watch stop failed: \(error ?? "unknown")")
            } else {
                NSLog("📍✅ Watch stopped")
            }
            dispatchGroup.leave()
        }

        // Arduino stop is handled by React layer
        NSLog("📍 [3/3] Arduino stop handled by React")

        // Wait for all to complete
        dispatchGroup.notify(queue: .main) { [weak self] in
            guard let self = self else { return }

            self.cancelStopTimeoutTimer()
            self.cancelWatchdogTimer()

            // Transition to IDLE
            self.state = .idle
            NSLog("📍 RecordingStateMachine: All sensors stopped, State → IDLE")

            // Broadcast state to Watch
            self.broadcastStateToWatch()

            // Build result
            let resultData = self.context.toDictionary()

            if errors.isEmpty {
                completion(true, nil, resultData)
            } else {
                completion(true, errors.joined(separator: "; "), resultData)
            }

            // Reset context after a delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.context = RecordingContext()
            }
        }
    }

    // MARK: - State Broadcasting

    private func broadcastStateToWatch() {
        WatchConnectivityManager.shared.sendRecordingStateUpdate(
            state.stringValue,
            sessionId: context.sessionId,
            plannedDuration: context.plannedDuration
        )
    }

    // MARK: - Error Handling

    private func transitionToError(_ message: String) {
        cancelStartTimeoutTimer()
        cancelStopTimeoutTimer()
        cancelWatchdogTimer()

        context.errorMessage = message
        context.errorTimestamp = Date()
        state = .error

        NSLog("📍❌ RecordingStateMachine: State → ERROR: \(message)")

        // Start auto-acknowledge timer so we self-heal
        startErrorAutoAcknowledgeTimer()

        // Try to cleanup any started sensors
        VideoRecordingManager.shared.forceResetRecordingState()
        WatchConnectivityManager.shared.sendStopCommand { _, _ in }

        // Broadcast error state to Watch
        broadcastStateToWatch()
    }

    // MARK: - Timeout Handling

    private func startStartTimeoutTimer() {
        cancelStartTimeoutTimer()

        startTimeoutTimer = Timer.scheduledTimer(withTimeInterval: startTimeoutSeconds, repeats: false) { [weak self] _ in
            guard let self = self else { return }

            if self.state == .starting {
                NSLog("📍⏱️ RecordingStateMachine: Start timeout reached!")
                self.transitionToError("Sensor initialization timed out after \(Int(self.startTimeoutSeconds))s")
            }
        }
    }

    private func cancelStartTimeoutTimer() {
        startTimeoutTimer?.invalidate()
        startTimeoutTimer = nil
    }

    private func startStopTimeoutTimer(completion: @escaping (Bool, String?, [String: Any]?) -> Void) {
        cancelStopTimeoutTimer()

        stopTimeoutTimer = Timer.scheduledTimer(withTimeInterval: stopTimeoutSeconds, repeats: false) { [weak self] _ in
            guard let self = self, self.state == .stopping else { return }

            NSLog("📍⚠️ RecordingStateMachine: Stop timeout - forcing transition to idle")

            // Force stop video if still recording
            if VideoRecordingManager.shared.isRecording {
                VideoRecordingManager.shared.forceResetRecordingState()
            }

            // Transition to idle
            self.state = .idle
            self.cancelWatchdogTimer()

            let resultData = self.context.toDictionary()
            completion(true, "Stop timeout - forced cleanup", resultData)

            // Reset context after a delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.context = RecordingContext()
            }
        }
    }

    private func cancelStopTimeoutTimer() {
        stopTimeoutTimer?.invalidate()
        stopTimeoutTimer = nil
    }

    private func startErrorAutoAcknowledgeTimer() {
        cancelErrorAutoAcknowledgeTimer()

        errorAutoAcknowledgeTimer = Timer.scheduledTimer(withTimeInterval: errorAutoAcknowledgeSeconds, repeats: false) { [weak self] _ in
            guard let self = self, self.state == .error else { return }

            NSLog("📍⚠️ RecordingStateMachine: Auto-acknowledging error after timeout")
            self.acknowledgeError()
        }
    }

    private func cancelErrorAutoAcknowledgeTimer() {
        errorAutoAcknowledgeTimer?.invalidate()
        errorAutoAcknowledgeTimer = nil
    }

    private func startWatchdogTimer() {
        cancelWatchdogTimer()

        watchdogTimer = Timer.scheduledTimer(withTimeInterval: watchdogIntervalSeconds, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            NSLog("📍🐕 RecordingStateMachine: Watchdog check - state: \(self.state)")

            // If stuck in a transitional state, auto-recover
            if self.state == .starting || self.state == .stopping {
                NSLog("📍⚠️ RecordingStateMachine: Stuck in \(self.state) state, forcing reset")
                self.forceReset()
            }
        }
    }

    private func cancelWatchdogTimer() {
        watchdogTimer?.invalidate()
        watchdogTimer = nil
    }

    // MARK: - State Change Notification

    private func notifyStateChange(_ change: RecordingStateChange) {
        NSLog("📍📢 RecordingStateMachine: State changed \(change.previousState) → \(change.newState)")

        // Notify delegate
        delegate?.recordingStateMachine(self, didChangeState: change)

        // Notify callback (for Capacitor plugin)
        onStateChange?(change)
    }
}

// MARK: - VideoRecordingManager Extension

extension VideoRecordingManager {
    /// Start recording with completion callback
    func startRecording(sessionId: String, completion: @escaping (Bool) -> Void) {
        do {
            try self.startRecording(sessionId: sessionId)
            completion(true)
        } catch {
            NSLog("🎥❌ VideoRecordingManager: startRecording failed: \(error.localizedDescription)")
            completion(false)
        }
    }
}

// MARK: - WatchConnectivityManager Extension

extension WatchConnectivityManager {
    /// Send recording state update to Watch
    func sendRecordingStateUpdate(_ state: String, sessionId: String?, plannedDuration: Int?) {
        guard WCSession.default.activationState == .activated else {
            NSLog("📱 WatchConnectivityManager: Cannot send state update - session not activated")
            return
        }

        guard WCSession.default.isReachable else {
            NSLog("📱 WatchConnectivityManager: Cannot send state update - Watch not reachable")
            return
        }

        var message: [String: Any] = [
            "type": "recording_state",
            "state": state,
            "timestamp": Date().timeIntervalSince1970
        ]

        if let sessionId = sessionId {
            message["sessionId"] = sessionId
        }
        if let duration = plannedDuration {
            message["plannedDuration"] = duration
        }

        NSLog("📱 WatchConnectivityManager: Sending state update to Watch: \(state)")

        WCSession.default.sendMessage(message, replyHandler: nil) { error in
            NSLog("📱⚠️ WatchConnectivityManager: State update send failed: \(error.localizedDescription)")
        }
    }
}
