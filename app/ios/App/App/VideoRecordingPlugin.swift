//
//  VideoRecordingPlugin.swift
//  App
//
//  Capacitor plugin for video recording
//

import Capacitor
import Foundation
import AVFoundation

@objc(VideoRecordingPlugin)
public class VideoRecordingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VideoRecordingPlugin"
    public let jsName = "VideoRecording"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecordingStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startPreview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopPreview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensurePreviewStopped", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "switchCamera", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateOverlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRecordingMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWebViewAlpha", returnType: CAPPluginReturnPromise)
    ]

    private let manager = VideoRecordingManager.shared
    private var previewView: UIView?

    // Native overlay views (on top of camera preview)
    private var overlayContainer: UIView?
    private var closeButton: UIButton?  // Close/back button (top left corner)
    private var durationBadge: UIView?
    private var durationLabel: UILabel?
    private var cameraSwitchButton: UIButton?
    private var recordingIndicator: UIView?
    private var recordingDot: UIView?
    private var recordingLabel: UILabel?
    private var timerContainer: UIView?
    private var timerLabel: UILabel?
    private var stopButton: UIButton?
    private var startButton: UIButton?  // Start recording button (shown in preview mode)
    private var startButtonContainer: UIView?  // Container for start button and hint
    private var startHintLabel: UILabel?  // "Tap to start recording" hint
    private var currentDurationMinutes: Int = 30

    // MARK: - Native Overlay Creation

    private func createOverlays(in parentView: UIView, previewFrame: CGRect) {
        // Create overlay container (fullscreen)
        let container = UIView(frame: previewFrame)
        container.backgroundColor = .clear
        container.isUserInteractionEnabled = true
        parentView.addSubview(container)
        self.overlayContainer = container

        // Get safe area insets for proper positioning around notch/home indicator
        let safeAreaTop: CGFloat = parentView.safeAreaInsets.top > 0 ? parentView.safeAreaInsets.top : 50
        let safeAreaBottom: CGFloat = parentView.safeAreaInsets.bottom > 0 ? parentView.safeAreaInsets.bottom : 34

        // Close button (top left, like Instagram X button)
        let closeBtn = UIButton(type: .system)
        closeBtn.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        closeBtn.layer.cornerRadius = 18
        closeBtn.setImage(UIImage(systemName: "xmark"), for: .normal)
        closeBtn.tintColor = .white
        closeBtn.translatesAutoresizingMaskIntoConstraints = false
        closeBtn.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
        container.addSubview(closeBtn)
        self.closeButton = closeBtn

        // Duration badge (top center, moved from left since close button is there)
        let badge = UIView()
        badge.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        badge.layer.cornerRadius = 16
        badge.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(badge)
        self.durationBadge = badge

        let durationLbl = UILabel()
        durationLbl.text = "\(currentDurationMinutes) min session"
        durationLbl.textColor = .white
        durationLbl.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        durationLbl.translatesAutoresizingMaskIntoConstraints = false
        badge.addSubview(durationLbl)
        self.durationLabel = durationLbl

        // Camera switch button (top right)
        let switchBtn = UIButton(type: .system)
        switchBtn.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        switchBtn.layer.cornerRadius = 18
        switchBtn.setTitle("  Front", for: .normal)
        switchBtn.setTitleColor(.white, for: .normal)
        switchBtn.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        switchBtn.setImage(UIImage(systemName: "arrow.triangle.2.circlepath.camera"), for: .normal)
        switchBtn.tintColor = .white
        switchBtn.translatesAutoresizingMaskIntoConstraints = false
        switchBtn.addTarget(self, action: #selector(switchCameraButtonTapped), for: .touchUpInside)
        container.addSubview(switchBtn)
        self.cameraSwitchButton = switchBtn

        // Recording indicator (top left, hidden initially)
        let recIndicator = UIView()
        recIndicator.backgroundColor = UIColor.red.withAlphaComponent(0.9)
        recIndicator.layer.cornerRadius = 16
        recIndicator.translatesAutoresizingMaskIntoConstraints = false
        recIndicator.isHidden = true
        container.addSubview(recIndicator)
        self.recordingIndicator = recIndicator

        let recDot = UIView()
        recDot.backgroundColor = .white
        recDot.layer.cornerRadius = 5
        recDot.translatesAutoresizingMaskIntoConstraints = false
        recIndicator.addSubview(recDot)
        self.recordingDot = recDot

        let recLabel = UILabel()
        recLabel.text = "REC"
        recLabel.textColor = .white
        recLabel.font = UIFont.systemFont(ofSize: 14, weight: .bold)
        recLabel.translatesAutoresizingMaskIntoConstraints = false
        recIndicator.addSubview(recLabel)
        self.recordingLabel = recLabel

        // Timer container (bottom center, hidden initially)
        let timerCont = UIView()
        timerCont.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        timerCont.layer.cornerRadius = 20
        timerCont.translatesAutoresizingMaskIntoConstraints = false
        timerCont.isHidden = true
        container.addSubview(timerCont)
        self.timerContainer = timerCont

        let timerLbl = UILabel()
        timerLbl.text = "0:00 / 30:00"
        timerLbl.textColor = .white
        timerLbl.font = UIFont.monospacedDigitSystemFont(ofSize: 20, weight: .bold)
        timerLbl.translatesAutoresizingMaskIntoConstraints = false
        timerCont.addSubview(timerLbl)
        self.timerLabel = timerLbl

        // Stop button (bottom right, hidden initially, shown during recording)
        let stopBtn = UIButton(type: .system)
        stopBtn.backgroundColor = UIColor.red
        stopBtn.layer.cornerRadius = 30
        stopBtn.setImage(UIImage(systemName: "stop.fill"), for: .normal)
        stopBtn.tintColor = .white
        stopBtn.translatesAutoresizingMaskIntoConstraints = false
        stopBtn.isHidden = true
        stopBtn.addTarget(self, action: #selector(stopButtonTapped), for: .touchUpInside)
        container.addSubview(stopBtn)
        self.stopButton = stopBtn

        // Start button container (bottom center, shown in preview mode before recording)
        let startContainer = UIView()
        startContainer.backgroundColor = .clear
        startContainer.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(startContainer)
        self.startButtonContainer = startContainer

        // Start recording button (large red circle with white circle inside)
        let startBtn = UIButton(type: .custom)
        startBtn.backgroundColor = UIColor.red
        startBtn.layer.cornerRadius = 35
        startBtn.layer.borderWidth = 4
        startBtn.layer.borderColor = UIColor.white.cgColor
        startBtn.translatesAutoresizingMaskIntoConstraints = false
        startBtn.addTarget(self, action: #selector(startButtonTapped), for: .touchUpInside)
        startContainer.addSubview(startBtn)
        self.startButton = startBtn

        // Inner white circle for start button
        let innerCircle = UIView()
        innerCircle.backgroundColor = .white
        innerCircle.layer.cornerRadius = 12
        innerCircle.translatesAutoresizingMaskIntoConstraints = false
        innerCircle.isUserInteractionEnabled = false
        startBtn.addSubview(innerCircle)

        // Hint label below start button
        let hintLabel = UILabel()
        hintLabel.text = "Tap to start recording"
        hintLabel.textColor = .white
        hintLabel.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        hintLabel.textAlignment = .center
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        startContainer.addSubview(hintLabel)
        self.startHintLabel = hintLabel

        // Layout constraints - use safe area offsets for fullscreen
        NSLayoutConstraint.activate([
            // Close button (top left)
            closeBtn.topAnchor.constraint(equalTo: container.topAnchor, constant: safeAreaTop + 10),
            closeBtn.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
            closeBtn.widthAnchor.constraint(equalToConstant: 36),
            closeBtn.heightAnchor.constraint(equalToConstant: 36),

            // Duration badge (top center, below safe area)
            badge.topAnchor.constraint(equalTo: container.topAnchor, constant: safeAreaTop + 10),
            badge.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            badge.heightAnchor.constraint(equalToConstant: 32),

            durationLbl.leadingAnchor.constraint(equalTo: badge.leadingAnchor, constant: 14),
            durationLbl.trailingAnchor.constraint(equalTo: badge.trailingAnchor, constant: -14),
            durationLbl.centerYAnchor.constraint(equalTo: badge.centerYAnchor),

            // Camera switch button (top right, below safe area)
            switchBtn.topAnchor.constraint(equalTo: container.topAnchor, constant: safeAreaTop + 10),
            switchBtn.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16),
            switchBtn.heightAnchor.constraint(equalToConstant: 36),
            switchBtn.widthAnchor.constraint(greaterThanOrEqualToConstant: 90),

            // Recording indicator (top center, same position as duration badge when recording)
            recIndicator.topAnchor.constraint(equalTo: container.topAnchor, constant: safeAreaTop + 10),
            recIndicator.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            recIndicator.heightAnchor.constraint(equalToConstant: 32),

            recDot.leadingAnchor.constraint(equalTo: recIndicator.leadingAnchor, constant: 12),
            recDot.centerYAnchor.constraint(equalTo: recIndicator.centerYAnchor),
            recDot.widthAnchor.constraint(equalToConstant: 10),
            recDot.heightAnchor.constraint(equalToConstant: 10),

            recLabel.leadingAnchor.constraint(equalTo: recDot.trailingAnchor, constant: 8),
            recLabel.trailingAnchor.constraint(equalTo: recIndicator.trailingAnchor, constant: -12),
            recLabel.centerYAnchor.constraint(equalTo: recIndicator.centerYAnchor),

            // Timer container (bottom center, above safe area)
            timerCont.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -(safeAreaBottom + 100)),
            timerCont.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            timerCont.heightAnchor.constraint(equalToConstant: 44),

            timerLbl.leadingAnchor.constraint(equalTo: timerCont.leadingAnchor, constant: 20),
            timerLbl.trailingAnchor.constraint(equalTo: timerCont.trailingAnchor, constant: -20),
            timerLbl.centerYAnchor.constraint(equalTo: timerCont.centerYAnchor),

            // Stop button (bottom right, above safe area)
            stopBtn.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -(safeAreaBottom + 20)),
            stopBtn.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -20),
            stopBtn.widthAnchor.constraint(equalToConstant: 60),
            stopBtn.heightAnchor.constraint(equalToConstant: 60),

            // Start button container (bottom center, above safe area)
            startContainer.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -(safeAreaBottom + 20)),
            startContainer.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            startContainer.widthAnchor.constraint(equalToConstant: 200),
            startContainer.heightAnchor.constraint(equalToConstant: 100),

            // Start button
            startBtn.topAnchor.constraint(equalTo: startContainer.topAnchor),
            startBtn.centerXAnchor.constraint(equalTo: startContainer.centerXAnchor),
            startBtn.widthAnchor.constraint(equalToConstant: 70),
            startBtn.heightAnchor.constraint(equalToConstant: 70),

            // Inner circle of start button
            innerCircle.centerXAnchor.constraint(equalTo: startBtn.centerXAnchor),
            innerCircle.centerYAnchor.constraint(equalTo: startBtn.centerYAnchor),
            innerCircle.widthAnchor.constraint(equalToConstant: 24),
            innerCircle.heightAnchor.constraint(equalToConstant: 24),

            // Hint label
            hintLabel.topAnchor.constraint(equalTo: startBtn.bottomAnchor, constant: 8),
            hintLabel.centerXAnchor.constraint(equalTo: startContainer.centerXAnchor),
        ])

        NSLog("🎥 VideoRecordingPlugin: Native overlays created successfully")
    }

    @objc private func closeButtonTapped() {
        NSLog("🎥 VideoRecordingPlugin: Close button tapped")
        // Notify JS to handle navigation back
        notifyListeners("closeButtonTapped", data: [
            "timestamp": Date().timeIntervalSince1970,
            "source": "native_overlay"
        ])
    }

    @objc private func switchCameraButtonTapped() {
        NSLog("🎥 VideoRecordingPlugin: Switch camera button tapped")
        do {
            let newPosition = try manager.switchCamera()
            let positionString = (newPosition == .back) ? "back" : "front"
            // Update button text
            DispatchQueue.main.async {
                let newTitle = (newPosition == .back) ? "  Front" : "  Back"
                self.cameraSwitchButton?.setTitle(newTitle, for: .normal)
            }
            // Notify JS
            notifyListeners("cameraSwitched", data: ["position": positionString])
        } catch {
            NSLog("🎥 VideoRecordingPlugin: Switch camera failed: \(error)")
        }
    }

    @objc private func startButtonTapped() {
        NSLog("🎥▶️ VideoRecordingPlugin: Native start button tapped!")
        NSLog("🎥▶️ Notifying JS via 'startButtonTapped' event...")

        // Notify JS to handle start recording
        notifyListeners("startButtonTapped", data: [
            "timestamp": Date().timeIntervalSince1970,
            "source": "native_overlay"
        ])

        NSLog("🎥▶️ 'startButtonTapped' event sent to JS")
    }

    @objc private func stopButtonTapped() {
        NSLog("🎥🛑 VideoRecordingPlugin: Native stop button tapped!")
        NSLog("🎥🛑 Notifying JS via 'stopButtonTapped' event...")

        // Notify JS to handle stop recording
        notifyListeners("stopButtonTapped", data: [
            "timestamp": Date().timeIntervalSince1970,
            "source": "native_overlay"
        ])

        NSLog("🎥🛑 'stopButtonTapped' event sent to JS")
    }

    private func removeOverlays() {
        overlayContainer?.removeFromSuperview()
        overlayContainer = nil
        closeButton = nil
        durationBadge = nil
        durationLabel = nil
        cameraSwitchButton = nil
        recordingIndicator = nil
        recordingDot = nil
        recordingLabel = nil
        timerContainer = nil
        timerLabel = nil
        stopButton = nil
        startButton = nil
        startButtonContainer = nil
        startHintLabel = nil
    }

    // MARK: - WebView Alpha Control

    /// Sets the webview visibility by controlling its alpha value.
    /// This prevents the webview content from flashing during camera preview transitions.
    private func setWebViewAlpha(_ alpha: CGFloat) {
        if let webView = self.bridge?.webView {
            DispatchQueue.main.async {
                webView.alpha = alpha
                NSLog("🎥 VideoRecordingPlugin: WebView alpha set to \(alpha)")
            }
        }
    }

    override public func load() {
        NSLog("🔌 VideoRecordingPlugin.load() CALLED")

        // Setup callbacks from manager
        manager.onRecordingStarted = { [weak self] in
            self?.notifyListeners("recordingStarted", data: [:])
        }

        manager.onRecordingError = { [weak self] error in
            self?.notifyListeners("recordingError", data: [
                "error": error.localizedDescription
            ])
        }

        manager.onRecordingStopped = { [weak self] url, duration in
            self?.notifyListeners("recordingStopped", data: [
                "videoPath": url.path,
                "durationMs": Int(duration * 1000)
            ])
        }

        manager.onRecordingProgress = { [weak self] duration in
            self?.notifyListeners("recordingProgress", data: [
                "durationMs": Int(duration * 1000)
            ])
        }

        NSLog("🔌 VideoRecordingPlugin loaded successfully")
    }

    deinit {
        previewView?.removeFromSuperview()
        overlayContainer?.removeFromSuperview()
        manager.cleanup()
    }

    // MARK: - Plugin Methods

    @objc func startRecording(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId") else {
            call.reject("sessionId is required")
            return
        }

        NSLog("🎥 VideoRecordingPlugin.startRecording(\(sessionId))")

        // Check permissions first, request if not granted
        checkCameraPermissions { [weak self] hasPermission in
            guard let self = self else { return }

            if hasPermission {
                self.doStartRecording(sessionId: sessionId, call: call)
            } else {
                // Request permissions if not granted
                NSLog("🎥 VideoRecordingPlugin: Permissions not granted, requesting...")
                self.requestCameraPermissions { granted in
                    if granted {
                        self.doStartRecording(sessionId: sessionId, call: call)
                    } else {
                        call.reject("Camera or microphone permission denied. Please enable in Settings.")
                    }
                }
            }
        }
    }

    private func doStartRecording(sessionId: String, call: CAPPluginCall) {
        NSLog("🎥 VideoRecordingPlugin: doStartRecording called with sessionId: \(sessionId)")
        do {
            try self.manager.startRecording(sessionId: sessionId)
            NSLog("🎥✅ VideoRecordingPlugin: Recording started successfully!")
            call.resolve([
                "success": true,
                "sessionId": sessionId
            ])
        } catch {
            NSLog("🎥❌ VideoRecordingPlugin: Start recording FAILED: \(error.localizedDescription)")
            call.reject("Failed to start recording: \(error.localizedDescription)")
        }
    }

    @objc func stopRecording(_ call: CAPPluginCall) {
        NSLog("🎥 VideoRecordingPlugin.stopRecording() called")
        NSLog("🎥 VideoRecordingPlugin: manager.isRecording = \(manager.getStatus()["isRecording"] ?? "unknown")")

        // Track if completion has been called (to avoid double-calling)
        var completionCalled = false

        // Use async version to wait for file to be written
        manager.stopRecordingAsync { result in
            guard !completionCalled else {
                NSLog("🎥 VideoRecordingPlugin: Ignoring duplicate completion")
                return
            }
            completionCalled = true

            switch result {
            case .success(let (url, durationMs)):
                NSLog("🎥✅ VideoRecordingPlugin: Recording stopped successfully!")
                NSLog("🎥✅ Video path: \(url.path)")
                NSLog("🎥✅ Duration: \(durationMs)ms")
                call.resolve([
                    "videoPath": url.path,
                    "durationMs": durationMs
                ])
            case .failure(let error):
                NSLog("🎥❌ VideoRecordingPlugin: Stop recording FAILED: \(error.localizedDescription)")
                // Even on failure, check if video file exists - it might have been saved anyway
                let status = self.manager.getStatus()
                NSLog("🎥❌ Manager status on failure: \(status)")
                call.reject("Failed to stop recording: \(error.localizedDescription)")
            }
        }

        // Timeout safety: resolve after 8 seconds if callback hasn't fired
        DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
            guard !completionCalled else { return }
            completionCalled = true
            NSLog("🎥⚠️ VideoRecordingPlugin: stopRecording timed out after 8s, resolving anyway")
            call.resolve([
                "videoPath": "",
                "durationMs": 0,
                "timedOut": true
            ])
        }
    }

    @objc func getRecordingStatus(_ call: CAPPluginCall) {
        let status = manager.getStatus()
        call.resolve(status)
    }

    @objc func startPreview(_ call: CAPPluginCall) {
        NSLog("🎥 VideoRecordingPlugin.startPreview()")

        // Check permissions first
        checkCameraPermissions { [weak self] hasPermission in
            guard let self = self else { return }

            if hasPermission {
                self.doStartPreview(call: call)
            } else {
                self.requestCameraPermissions { granted in
                    if granted {
                        self.doStartPreview(call: call)
                    } else {
                        call.reject("Camera permission denied. Please enable in Settings.")
                    }
                }
            }
        }
    }

    private func doStartPreview(call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                NSLog("🎥 VideoRecordingPlugin: self is nil")
                return
            }

            NSLog("🎥 VideoRecordingPlugin: doStartPreview - getting webView")

            // Get the web view and its parent
            guard let webView = self.bridge?.webView else {
                NSLog("🎥 VideoRecordingPlugin: webView is nil")
                call.reject("Cannot access web view")
                return
            }

            guard let parentView = webView.superview else {
                NSLog("🎥 VideoRecordingPlugin: parentView is nil")
                call.reject("Cannot access parent view")
                return
            }

            let screenBounds = UIScreen.main.bounds
            NSLog("🎥 VideoRecordingPlugin: Screen bounds = \(screenBounds)")
            NSLog("🎥 VideoRecordingPlugin: webView bounds = \(webView.bounds)")

            // FULLSCREEN camera preview (like Instagram/Snapchat)
            // Cover the entire screen for immersive camera experience
            let previewFrame = screenBounds

            NSLog("🎥 VideoRecordingPlugin: Preview frame will be FULLSCREEN: \(previewFrame)")

            // Create preview view if needed
            if self.previewView == nil {
                let preview = UIView(frame: previewFrame)
                preview.backgroundColor = .black  // Black background for camera
                preview.clipsToBounds = true
                self.previewView = preview
                NSLog("🎥 VideoRecordingPlugin: Created new preview view")
            }

            guard let previewView = self.previewView else {
                call.reject("Failed to create preview view")
                return
            }

            // Update frame
            previewView.frame = previewFrame

            // IMPORTANT: Add preview view ON TOP of the webview
            // Camera will be visible because preview is on top
            parentView.addSubview(previewView)
            NSLog("🎥 VideoRecordingPlugin: Added preview view ON TOP of webView")

            // Create overlay container on top of preview
            self.createOverlays(in: parentView, previewFrame: previewFrame)
            NSLog("🎥 VideoRecordingPlugin: Created native overlays")
            NSLog("🎥 VideoRecordingPlugin: Parent now has \(parentView.subviews.count) subviews")

            do {
                try self.manager.startPreview(in: previewView)
                NSLog("🎥 VideoRecordingPlugin: Preview started successfully")

                // Hide webview to prevent flash during transitions
                // The webview content is hidden while native camera preview is visible
                self.setWebViewAlpha(0)

                // Verify after a delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    let sublayerCount = previewView.layer.sublayers?.count ?? 0
                    let isRunning = self.manager.isPreviewActive
                    NSLog("🎥 VideoRecordingPlugin: Verification - previewView sublayers: \(sublayerCount), isPreviewActive: \(isRunning)")
                    NSLog("🎥 VideoRecordingPlugin: previewView frame: \(previewView.frame)")
                    NSLog("🎥 VideoRecordingPlugin: previewView isHidden: \(previewView.isHidden), alpha: \(previewView.alpha)")

                    // Check view hierarchy
                    for (index, subview) in parentView.subviews.enumerated() {
                        NSLog("🎥 VideoRecordingPlugin: Subview \(index): \(type(of: subview))")
                    }
                }

                call.resolve(["success": true])
            } catch {
                NSLog("🎥 VideoRecordingPlugin: Start preview failed: \(error.localizedDescription)")
                // Restore webview alpha on failure
                self.setWebViewAlpha(1)
                call.reject("Failed to start preview: \(error.localizedDescription)")
            }
        }
    }

    @objc func stopPreview(_ call: CAPPluginCall) {
        NSLog("🎥 VideoRecordingPlugin.stopPreview()")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.manager.stopPreview()

            // Remove overlays
            self.removeOverlays()
            NSLog("🎥 VideoRecordingPlugin: Overlays removed")

            // Remove preview view from superview
            self.previewView?.removeFromSuperview()
            self.previewView = nil
            NSLog("🎥 VideoRecordingPlugin: Preview view removed")

            // CRITICAL: Restore webview visibility so React UI is visible again
            self.setWebViewAlpha(1)
            NSLog("🎥 VideoRecordingPlugin: Webview alpha restored to 1")

            call.resolve(["success": true])
        }
    }

    /// Forcefully stops preview regardless of state - used for cleanup during navigation
    @objc func ensurePreviewStopped(_ call: CAPPluginCall) {
        NSLog("🎥 VideoRecordingPlugin.ensurePreviewStopped()")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve(["success": true])
                return
            }

            // Remove preview view if it exists (regardless of manager state)
            self.previewView?.removeFromSuperview()
            self.previewView = nil

            // Remove overlays
            self.removeOverlays()

            // Stop manager preview
            self.manager.stopPreview()

            // CRITICAL: Restore webview visibility so React UI is visible again
            self.setWebViewAlpha(1)
            NSLog("🎥 VideoRecordingPlugin: Webview alpha restored to 1")

            NSLog("🎥 VideoRecordingPlugin: ensurePreviewStopped completed")
            call.resolve(["success": true])
        }
    }

    @objc func switchCamera(_ call: CAPPluginCall) {
        NSLog("🎥 VideoRecordingPlugin.switchCamera()")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            do {
                let newPosition = try self.manager.switchCamera()
                let positionString = (newPosition == .back) ? "back" : "front"
                NSLog("🎥 VideoRecordingPlugin: Switched to \(positionString) camera")

                // Update native button
                let newTitle = (newPosition == .back) ? "  Front" : "  Back"
                self.cameraSwitchButton?.setTitle(newTitle, for: .normal)

                call.resolve([
                    "success": true,
                    "position": positionString
                ])
            } catch {
                NSLog("🎥 VideoRecordingPlugin: Switch camera failed: \(error.localizedDescription)")
                call.reject("Failed to switch camera: \(error.localizedDescription)")
            }
        }
    }

    @objc func updateOverlay(_ call: CAPPluginCall) {
        let durationMinutes = call.getInt("durationMinutes") ?? currentDurationMinutes
        let elapsedSeconds = call.getInt("elapsedSeconds") ?? 0
        let totalSeconds = call.getInt("totalSeconds") ?? (durationMinutes * 60)

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.currentDurationMinutes = durationMinutes
            self.durationLabel?.text = "\(durationMinutes) min session"

            // Update timer
            let elapsedMin = elapsedSeconds / 60
            let elapsedSec = elapsedSeconds % 60
            let totalMin = totalSeconds / 60
            let totalSec = totalSeconds % 60
            self.timerLabel?.text = String(format: "%d:%02d / %d:%02d", elapsedMin, elapsedSec, totalMin, totalSec)

            call.resolve(["success": true])
        }
    }

    @objc func setRecordingMode(_ call: CAPPluginCall) {
        let isRecording = call.getBool("isRecording") ?? false

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if isRecording {
                // Show recording indicator, timer, and stop button
                // Hide close button, duration badge, switch button, and start button
                self.closeButton?.isHidden = true
                self.durationBadge?.isHidden = true
                self.cameraSwitchButton?.isHidden = true
                self.startButtonContainer?.isHidden = true
                self.recordingIndicator?.isHidden = false
                self.timerContainer?.isHidden = false
                self.stopButton?.isHidden = false

                // Start blinking animation for recording dot
                self.startRecordingDotAnimation()
            } else {
                // Show close button, duration badge, switch button, and start button
                // Hide recording indicator, timer, and stop button
                self.closeButton?.isHidden = false
                self.durationBadge?.isHidden = false
                self.cameraSwitchButton?.isHidden = false
                self.startButtonContainer?.isHidden = false
                self.recordingIndicator?.isHidden = true
                self.timerContainer?.isHidden = true
                self.stopButton?.isHidden = true

                // Stop blinking animation
                self.stopRecordingDotAnimation()
            }

            NSLog("🎥 VideoRecordingPlugin: Recording mode set to \(isRecording)")
            call.resolve(["success": true])
        }
    }

    private func startRecordingDotAnimation() {
        UIView.animate(withDuration: 0.5, delay: 0, options: [.repeat, .autoreverse], animations: {
            self.recordingDot?.alpha = 0.3
        })
    }

    private func stopRecordingDotAnimation() {
        recordingDot?.layer.removeAllAnimations()
        recordingDot?.alpha = 1.0
    }

    /// Sets the webview alpha from JavaScript.
    /// Used to hide/show webview during camera preview transitions to prevent flash.
    @objc func setWebViewAlpha(_ call: CAPPluginCall) {
        let alpha = call.getFloat("alpha") ?? 1.0
        NSLog("🎥 VideoRecordingPlugin.setWebViewAlpha(\(alpha))")

        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.alpha = CGFloat(alpha)
            NSLog("🎥 VideoRecordingPlugin: WebView alpha set to \(alpha)")
            call.resolve(["success": true])
        }
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        checkCameraPermissions { hasPermission in
            call.resolve([
                "camera": hasPermission ? "granted" : "denied",
                "microphone": hasPermission ? "granted" : "denied"
            ])
        }
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        requestCameraPermissions { [weak self] granted in
            if granted {
                call.resolve([
                    "camera": "granted",
                    "microphone": "granted"
                ])
            } else {
                call.resolve([
                    "camera": "denied",
                    "microphone": "denied"
                ])
            }
        }
    }

    // MARK: - Permission Helpers

    private func checkCameraPermissions(completion: @escaping (Bool) -> Void) {
        let cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)
        let audioStatus = AVCaptureDevice.authorizationStatus(for: .audio)

        NSLog("🎥 Permission status - Camera: \(cameraStatus.rawValue), Audio: \(audioStatus.rawValue)")
        // 0 = notDetermined, 1 = restricted, 2 = denied, 3 = authorized

        let hasPermission = cameraStatus == .authorized && audioStatus == .authorized
        completion(hasPermission)
    }

    private func requestCameraPermissions(completion: @escaping (Bool) -> Void) {
        var cameraGranted = false
        var audioGranted = false
        let group = DispatchGroup()

        // Request camera permission
        group.enter()
        AVCaptureDevice.requestAccess(for: .video) { granted in
            cameraGranted = granted
            group.leave()
        }

        // Request microphone permission
        group.enter()
        AVCaptureDevice.requestAccess(for: .audio) { granted in
            audioGranted = granted
            group.leave()
        }

        group.notify(queue: .main) {
            completion(cameraGranted && audioGranted)
        }
    }
}
