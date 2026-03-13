//
//  AudioPlaybackManager.swift
//  App
//
//  Receives PCM audio data from Apple Watch and plays it in real-time
//  using AVAudioEngine. Supports mute/unmute control.
//

import Foundation
import AVFoundation

class AudioPlaybackManager: NSObject {
    static let shared = AudioPlaybackManager()

    private let audioEngine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()

    // Audio format matching watch: 16kHz mono Float32
    private let sampleRate: Double = 16000
    private var audioFormat: AVAudioFormat?

    // State
    private(set) var isPlaying = false
    private(set) var isReceiving = false
    private(set) var currentDbLevel: Float = -60.0
    var isMuted = false {
        didSet {
            playerNode.volume = isMuted ? 0.0 : 1.0
            print("🔊 AudioPlaybackManager: Muted = \(isMuted)")
        }
    }

    // Buffer management
    private var lastDataTime = Date()
    private let receiveTimeout: TimeInterval = 1.0  // Consider "not receiving" after 1 second

    private override init() {
        super.init()
        setupAudioEngine()

        // Timer to check if we're still receiving data
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.checkReceiveStatus()
        }
    }

    // MARK: - Setup

    private func setupAudioEngine() {
        // Create audio format: 16kHz mono Float32
        guard let format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: false
        ) else {
            print("❌ AudioPlaybackManager: Failed to create audio format")
            return
        }
        audioFormat = format

        // Attach player node to engine
        audioEngine.attach(playerNode)

        // Connect player to output
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: format)

        print("🔊 AudioPlaybackManager: Initialized with format \(sampleRate)Hz mono Float32")
    }

    // MARK: - Public Methods

    func start() {
        guard !isPlaying else { return }

        do {
            // Configure audio session for playback
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true, options: [])

            // Start engine and player
            try audioEngine.start()
            playerNode.play()
            isPlaying = true

            print("🔊 AudioPlaybackManager: Started playback")
        } catch {
//            print("❌ AudioPlaybackManager: Failed to start: \(error.localizedDescription)")
        }
    }

    func stop() {
        guard isPlaying else { return }

        playerNode.stop()
        audioEngine.stop()
        isPlaying = false
        isReceiving = false
        currentDbLevel = -60.0

        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            // Non-fatal
        }

        print("🔊 AudioPlaybackManager: Stopped playback")
    }

    // Called by WatchConnectivityManager when audio data arrives
    func receiveAudioData(_ data: Data, dbLevel: Float) {
        // Update state
        currentDbLevel = dbLevel
        lastDataTime = Date()

        if !isReceiving {
            isReceiving = true
            print("🔊 AudioPlaybackManager: Started receiving audio")
        }

        // Auto-start if not playing
        if !isPlaying {
            start()
        }

        // Don't process if muted (still track dB level though)
        guard !isMuted else { return }

        // Convert Data to AVAudioPCMBuffer
        guard let format = audioFormat else { return }

        let frameCount = AVAudioFrameCount(data.count / MemoryLayout<Float>.size)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
            return
        }

        buffer.frameLength = frameCount

        // Copy data to buffer
        data.withUnsafeBytes { ptr in
            guard let floatPtr = ptr.baseAddress?.assumingMemoryBound(to: Float.self) else { return }
            if let channelData = buffer.floatChannelData?[0] {
                memcpy(channelData, floatPtr, data.count)
            }
        }

        // Schedule buffer for playback
        playerNode.scheduleBuffer(buffer, completionHandler: nil)
    }

    // MARK: - Private Methods

    private func checkReceiveStatus() {
        let timeSinceLastData = Date().timeIntervalSince(lastDataTime)
        if timeSinceLastData > receiveTimeout && isReceiving {
            isReceiving = false
            currentDbLevel = -60.0
            print("🔊 AudioPlaybackManager: No longer receiving audio")
        }
    }

    // MARK: - Status

    func getStatus() -> [String: Any] {
        return [
            "isPlaying": isPlaying,
            "isReceiving": isReceiving,
            "isMuted": isMuted,
            "dbLevel": currentDbLevel
        ]
    }
}
