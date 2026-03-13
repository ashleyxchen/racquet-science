//
//  VideoRecordingManager.swift
//  App
//
//  Manages video recording using AVFoundation
//

import AVFoundation
import UIKit

class VideoRecordingManager: NSObject {
    static let shared = VideoRecordingManager()

    // MARK: - Properties
    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureMovieFileOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var currentSessionId: String?
    private var recordingStartTime: Date?

    private var isRecording = false
    private var videoOutputURL: URL?
    private var currentCameraPosition: AVCaptureDevice.Position = .back  // Default to back camera

    // Callback for status updates
    var onRecordingProgress: ((TimeInterval) -> Void)?
    var onRecordingError: ((Error) -> Void)?
    var onRecordingStarted: (() -> Void)?
    var onRecordingStopped: ((URL, TimeInterval) -> Void)?

    // Completion handler for stopRecording (to wait for file to be written)
    private var stopRecordingCompletion: ((Result<(url: URL, durationMs: Int), Error>) -> Void)?

    // MARK: - Initialization
    private override init() {
        super.init()
    }

    // MARK: - Preview Methods

    /// Start camera preview and attach to a view
    /// - Parameter view: UIView to attach the preview layer to
    /// - Throws: Setup errors
    func startPreview(in view: UIView) throws {
        NSLog("🎥 VideoRecordingManager: Starting preview in view with bounds: \(view.bounds)")
        NSLog("🎥 VideoRecordingManager: View layer bounds: \(view.layer.bounds)")

        // Setup capture session if needed
        if captureSession == nil {
            NSLog("🎥 VideoRecordingManager: Setting up capture session...")
            try setupCaptureSession()
            NSLog("🎥 VideoRecordingManager: Capture session setup complete")
        }

        guard let captureSession = captureSession else {
            NSLog("🎥 VideoRecordingManager: ERROR - captureSession is nil after setup")
            throw VideoRecordingError.sessionNotReady
        }

        // Remove old preview layer if exists
        if let oldLayer = previewLayer {
            NSLog("🎥 VideoRecordingManager: Removing old preview layer")
            oldLayer.removeFromSuperlayer()
        }

        // Create preview layer
        let preview = AVCaptureVideoPreviewLayer(session: captureSession)
        preview.videoGravity = .resizeAspectFill

        // Use full screen bounds to ensure visibility
        let screenBounds = UIScreen.main.bounds
        preview.frame = screenBounds
        NSLog("🎥 VideoRecordingManager: Created preview layer with frame: \(preview.frame), screen bounds: \(screenBounds)")

        // Add new preview layer BEFORE starting session
        view.layer.insertSublayer(preview, at: 0)
        self.previewLayer = preview
        NSLog("🎥 VideoRecordingManager: Added preview layer to view. View sublayers count: \(view.layer.sublayers?.count ?? 0)")

        // Start session if not running
        if !captureSession.isRunning {
            NSLog("🎥 VideoRecordingManager: Starting capture session on background thread...")
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                captureSession.startRunning()

                DispatchQueue.main.async {
                    guard let self = self else { return }
                    let isRunning = captureSession.isRunning
                    NSLog("🎥 VideoRecordingManager: Capture session isRunning = \(isRunning)")

                    // Update preview layer frame after session starts
                    self.previewLayer?.frame = view.bounds
                    NSLog("🎥 VideoRecordingManager: Updated preview layer frame to: \(self.previewLayer?.frame ?? .zero)")

                    // Configure connection for mirroring after session starts (only mirror front camera)
                    if let connection = self.previewLayer?.connection {
                        NSLog("🎥 VideoRecordingManager: Preview connection exists, camera position: \(self.currentCameraPosition == .back ? "back" : "front")")
                        if connection.isVideoMirroringSupported {
                            connection.automaticallyAdjustsVideoMirroring = false
                            connection.isVideoMirrored = (self.currentCameraPosition == .front)
                        }
                        NSLog("🎥 VideoRecordingManager: Connection isEnabled: \(connection.isEnabled), isActive: \(connection.isActive)")
                    } else {
                        NSLog("🎥 VideoRecordingManager: WARNING - Still no preview connection after session start!")
                    }

                    // Check inputs and outputs
                    NSLog("🎥 VideoRecordingManager: Session inputs: \(captureSession.inputs.count), outputs: \(captureSession.outputs.count)")
                }
            }
        } else {
            NSLog("🎥 VideoRecordingManager: Capture session already running")

            // Configure connection for mirroring (only mirror front camera)
            if let connection = preview.connection {
                NSLog("🎥 VideoRecordingManager: Preview connection exists, camera position: \(currentCameraPosition == .back ? "back" : "front")")
                if connection.isVideoMirroringSupported {
                    connection.automaticallyAdjustsVideoMirroring = false
                    connection.isVideoMirrored = (currentCameraPosition == .front)
                }
            }
        }

        NSLog("🎥 VideoRecordingManager: Preview setup complete")
    }

    /// Stop camera preview
    func stopPreview() {
        NSLog("🎥 VideoRecordingManager: Stopping preview")
        previewLayer?.removeFromSuperlayer()
        previewLayer = nil

        // Only stop session if not recording
        if !isRecording {
            captureSession?.stopRunning()
        }
    }

    /// Update preview layer frame (call on orientation change or layout update)
    func updatePreviewFrame(_ frame: CGRect) {
        previewLayer?.frame = frame
    }

    /// Check if preview is active
    var isPreviewActive: Bool {
        return previewLayer != nil && (captureSession?.isRunning ?? false)
    }

    // MARK: - Recording Methods

    /// Start video recording for a given session
    /// - Parameter sessionId: Unique session identifier
    /// - Throws: Recording errors
    func startRecording(sessionId: String) throws {
        guard !isRecording else {
            throw VideoRecordingError.alreadyRecording
        }

        NSLog("🎥 VideoRecordingManager: Starting recording for session \(sessionId)")

        // Create session directory
        let sessionDir = try createSessionDirectory(sessionId: sessionId)
        let videoURL = sessionDir.appendingPathComponent("video.mp4")

        // Setup capture session if needed
        if captureSession == nil {
            try setupCaptureSession()
        }

        guard let captureSession = captureSession,
              let videoOutput = videoOutput else {
            throw VideoRecordingError.sessionNotReady
        }

        // Start capture session if not running and WAIT for it to be ready
        // This fixes the '!pri' error caused by starting recording before session is ready
        if !captureSession.isRunning {
            NSLog("🎥 VideoRecordingManager: Starting capture session and waiting...")

            // Start on background thread
            let semaphore = DispatchSemaphore(value: 0)
            var sessionStarted = false

            DispatchQueue.global(qos: .userInitiated).async {
                captureSession.startRunning()
                sessionStarted = captureSession.isRunning
                semaphore.signal()
            }

            // Wait for session to start with timeout
            let waitResult = semaphore.wait(timeout: .now() + 2.0) // 2 second timeout

            if waitResult == .timedOut {
                NSLog("🎥 VideoRecordingManager: WARNING - Capture session start timed out")
                // Continue anyway - session may still be starting
            }

            // Additional polling to ensure session is running
            var attempts = 0
            while !captureSession.isRunning && attempts < 50 {
                Thread.sleep(forTimeInterval: 0.01) // 10ms
                attempts += 1
            }

            if !captureSession.isRunning {
                NSLog("🎥 VideoRecordingManager: ERROR - Capture session failed to start after \(attempts * 10)ms")
                throw VideoRecordingError.sessionNotReady
            }

            NSLog("🎥 VideoRecordingManager: Capture session started after \(attempts * 10)ms")
        }

        // Remove existing file if present
        if FileManager.default.fileExists(atPath: videoURL.path) {
            try? FileManager.default.removeItem(at: videoURL)
        }

        // Now safe to start recording - session is confirmed running
        videoOutput.startRecording(to: videoURL, recordingDelegate: self)

        currentSessionId = sessionId
        recordingStartTime = Date()
        videoOutputURL = videoURL
        isRecording = true

        NSLog("🎥 VideoRecordingManager: Recording started to \(videoURL.path)")
        onRecordingStarted?()
    }

    /// Stop the current recording (synchronous - returns immediately, file may not be ready)
    /// - Returns: Tuple of (video file URL, duration in milliseconds)
    /// - Throws: Recording errors
    /// - Note: Prefer using stopRecordingAsync for reliable file access
    func stopRecording() throws -> (url: URL, durationMs: Int) {
        guard isRecording else {
            throw VideoRecordingError.notRecording
        }

        guard let videoOutput = videoOutput else {
            throw VideoRecordingError.sessionNotReady
        }

        NSLog("🎥 VideoRecordingManager: Stopping recording")

        videoOutput.stopRecording()

        // Calculate duration
        let duration = recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
        let durationMs = Int(duration * 1000)

        guard let videoURL = videoOutputURL else {
            throw VideoRecordingError.noOutputFile
        }

        isRecording = false

        return (url: videoURL, durationMs: durationMs)
    }

    /// Stop the current recording and wait for file to be written
    /// - Parameter completion: Called when file is ready with Result containing (url, durationMs) or error
    func stopRecordingAsync(completion: @escaping (Result<(url: URL, durationMs: Int), Error>) -> Void) {
        NSLog("🎥 VideoRecordingManager: stopRecordingAsync called, isRecording=\(isRecording), videoOutputURL=\(videoOutputURL?.path ?? "nil")")

        // First, check if we have a valid video file (handles double-stop gracefully)
        if let videoURL = videoOutputURL, FileManager.default.fileExists(atPath: videoURL.path) {
            // Get file size to verify it's not empty
            let fileSize = (try? FileManager.default.attributesOfItem(atPath: videoURL.path)[.size] as? Int) ?? 0
            NSLog("🎥 VideoRecordingManager: Video file exists at \(videoURL.path), size: \(fileSize) bytes")

            if fileSize > 0 {
                // Valid video file exists - return it even if isRecording is false
                let duration = recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
                let durationMs = Int(duration * 1000)
                NSLog("🎥 VideoRecordingManager: Returning existing video file")
                completion(.success((url: videoURL, durationMs: durationMs)))
                return
            }
        }

        guard isRecording else {
            NSLog("🎥 VideoRecordingManager: Not recording and no valid video file")
            completion(.failure(VideoRecordingError.notRecording))
            return
        }

        guard let videoOutput = videoOutput else {
            completion(.failure(VideoRecordingError.sessionNotReady))
            return
        }

        NSLog("🎥 VideoRecordingManager: Stopping recording (async)")

        // Store completion handler to be called when delegate fires
        self.stopRecordingCompletion = completion

        // Mark as not recording immediately to prevent double-stop
        isRecording = false

        // This triggers the delegate callback when file is actually written
        videoOutput.stopRecording()
    }

    /// Get current recording status
    /// - Returns: Dictionary with isRecording and durationMs
    func getStatus() -> [String: Any] {
        var status: [String: Any] = [
            "isRecording": isRecording
        ]

        if isRecording, let startTime = recordingStartTime {
            let duration = Date().timeIntervalSince(startTime)
            status["durationMs"] = Int(duration * 1000)
        } else {
            status["durationMs"] = 0
        }

        if let sessionId = currentSessionId {
            status["sessionId"] = sessionId
        }

        return status
    }

    /// Cleanup resources
    func cleanup() {
        if isRecording {
            videoOutput?.stopRecording()
        }

        captureSession?.stopRunning()
        captureSession = nil
        videoOutput = nil
        previewLayer = nil
        currentSessionId = nil
        recordingStartTime = nil
        isRecording = false
        stopRecordingCompletion = nil
    }

    // MARK: - Private Methods

    private func setupCaptureSession() throws {
        let session = AVCaptureSession()
        session.sessionPreset = .high

        // Get camera based on current position (default: back)
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: currentCameraPosition) else {
            throw VideoRecordingError.cameraNotAvailable
        }

        NSLog("🎥 VideoRecordingManager: Setting up with \(currentCameraPosition == .back ? "back" : "front") camera")

        // Add video input
        let videoInput = try AVCaptureDeviceInput(device: camera)
        guard session.canAddInput(videoInput) else {
            throw VideoRecordingError.cannotAddInput
        }
        session.addInput(videoInput)

        // Add audio input
        if let audioDevice = AVCaptureDevice.default(for: .audio) {
            let audioInput = try AVCaptureDeviceInput(device: audioDevice)
            if session.canAddInput(audioInput) {
                session.addInput(audioInput)
            }
        }

        // Setup video output
        let output = AVCaptureMovieFileOutput()

        // Set max recording duration (2 hours)
        output.maxRecordedDuration = CMTime(seconds: 7200, preferredTimescale: 1)

        guard session.canAddOutput(output) else {
            throw VideoRecordingError.cannotAddOutput
        }
        session.addOutput(output)

        // Configure video connection - mirror only for front camera
        if let connection = output.connection(with: .video) {
            if connection.isVideoMirroringSupported {
                connection.isVideoMirrored = (currentCameraPosition == .front)
            }
            if connection.isVideoStabilizationSupported {
                connection.preferredVideoStabilizationMode = .auto
            }
        }

        self.captureSession = session
        self.videoOutput = output

        NSLog("🎥 VideoRecordingManager: Capture session setup complete")
    }

    /// Switch between front and back camera
    /// - Returns: The new camera position
    func switchCamera() throws -> AVCaptureDevice.Position {
        guard let session = captureSession else {
            throw VideoRecordingError.sessionNotReady
        }

        // Don't allow switching while recording
        guard !isRecording else {
            throw VideoRecordingError.alreadyRecording
        }

        // Determine new position
        let newPosition: AVCaptureDevice.Position = (currentCameraPosition == .back) ? .front : .back

        // Get new camera
        guard let newCamera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition) else {
            throw VideoRecordingError.cameraNotAvailable
        }

        NSLog("🎥 VideoRecordingManager: Switching to \(newPosition == .back ? "back" : "front") camera")

        // Begin configuration
        session.beginConfiguration()

        // Remove existing video input
        if let currentInput = session.inputs.first(where: { input in
            guard let deviceInput = input as? AVCaptureDeviceInput else { return false }
            return deviceInput.device.hasMediaType(.video)
        }) {
            session.removeInput(currentInput)
        }

        // Add new video input
        do {
            let newInput = try AVCaptureDeviceInput(device: newCamera)
            if session.canAddInput(newInput) {
                session.addInput(newInput)
            } else {
                session.commitConfiguration()
                throw VideoRecordingError.cannotAddInput
            }
        } catch {
            session.commitConfiguration()
            throw error
        }

        // Update mirroring for video output
        if let connection = videoOutput?.connection(with: .video) {
            if connection.isVideoMirroringSupported {
                connection.isVideoMirrored = (newPosition == .front)
            }
        }

        // Update mirroring for preview layer
        if let previewConnection = previewLayer?.connection {
            if previewConnection.isVideoMirroringSupported {
                previewConnection.automaticallyAdjustsVideoMirroring = false
                previewConnection.isVideoMirrored = (newPosition == .front)
            }
        }

        // Commit configuration
        session.commitConfiguration()

        // Update current position
        currentCameraPosition = newPosition

        NSLog("🎥 VideoRecordingManager: Camera switched to \(newPosition == .back ? "back" : "front")")

        return newPosition
    }

    /// Get current camera position
    var cameraPosition: AVCaptureDevice.Position {
        return currentCameraPosition
    }

    private func createSessionDirectory(sessionId: String) throws -> URL {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let sessionsDir = documentsPath.appendingPathComponent("sessions")
        let sessionDir = sessionsDir.appendingPathComponent(sessionId)

        try FileManager.default.createDirectory(at: sessionDir, withIntermediateDirectories: true, attributes: nil)

        return sessionDir
    }
}

// MARK: - AVCaptureFileOutputRecordingDelegate

extension VideoRecordingManager: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        NSLog("🎥 Recording started to file: \(fileURL.path)")
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        let duration = recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
        let durationMs = Int(duration * 1000)

        if let error = error {
            let nsError = error as NSError
            NSLog("🎥 Recording delegate received error - domain: \(nsError.domain), code: \(nsError.code), description: \(error.localizedDescription)")

            // AVFoundation sends an "error" even on successful manual stop
            // Common codes that are actually success:
            // -11806: AVErrorRecordingSuccessfullyFinished
            // -11818: AVErrorSessionWasInterrupted (can happen on normal stop too)
            // We should check if the file exists and has content - that's the real success indicator
            let fileExists = FileManager.default.fileExists(atPath: outputFileURL.path)

            if fileExists {
                // File was written successfully - treat as success regardless of error code
                NSLog("🎥 Recording finished with 'error' but file exists - treating as success")
            } else {
                // File doesn't exist - this is a real error
                NSLog("🎥 Recording finished with error and NO file: \(error.localizedDescription)")
                onRecordingError?(error)
                stopRecordingCompletion?(.failure(error))
                stopRecordingCompletion = nil
                return
            }
        }

        NSLog("🎥 Recording finished successfully. Duration: \(duration)s, File: \(outputFileURL.path)")

        // Verify file exists
        let fileExists = FileManager.default.fileExists(atPath: outputFileURL.path)
        NSLog("🎥 Video file exists: \(fileExists)")

        // Store the URL for potential future access
        self.videoOutputURL = outputFileURL

        onRecordingStopped?(outputFileURL, duration)
        stopRecordingCompletion?(.success((url: outputFileURL, durationMs: durationMs)))
        stopRecordingCompletion = nil
    }
}

// MARK: - Error Types

enum VideoRecordingError: LocalizedError {
    case alreadyRecording
    case notRecording
    case sessionNotReady
    case cameraNotAvailable
    case cannotAddInput
    case cannotAddOutput
    case noOutputFile
    case permissionDenied

    var errorDescription: String? {
        switch self {
        case .alreadyRecording:
            return "A recording is already in progress"
        case .notRecording:
            return "No recording is currently in progress"
        case .sessionNotReady:
            return "Capture session is not ready"
        case .cameraNotAvailable:
            return "Front camera is not available"
        case .cannotAddInput:
            return "Cannot add video input to capture session"
        case .cannotAddOutput:
            return "Cannot add video output to capture session"
        case .noOutputFile:
            return "No output file URL available"
        case .permissionDenied:
            return "Camera or microphone permission denied"
        }
    }
}
