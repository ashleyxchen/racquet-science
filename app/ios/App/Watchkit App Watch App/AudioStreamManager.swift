//
//  AudioStreamManager.swift
//  Watchkit App Watch App
//
//  Captures audio from the microphone using AVAudioEngine and streams
//  PCM data + dB levels to the paired iPhone via WatchConnectivity.
//

import Foundation
import AVFoundation
import WatchConnectivity

class AudioStreamManager: NSObject {
    static let shared = AudioStreamManager()

    private let audioEngine = AVAudioEngine()
    private var isStreaming = false

    // Audio format: 16kHz mono Float32
    private let sampleRate: Double = 16000
    private let bufferSize: AVAudioFrameCount = 1024  // ~64ms at 16kHz

    // Current dB level (updated with each buffer)
    private(set) var currentDbLevel: Float = -60.0

    private override init() {
        super.init()
    }

    // MARK: - Public Methods

    func startStreaming() {
        guard !isStreaming else {
            print("🎙️ AudioStreamManager: Already streaming")
            return
        }

        // Request microphone permission
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            guard let self = self else { return }

            DispatchQueue.main.async {
                if granted {
                    self.setupAndStartAudioEngine()
                } else {
                    print("❌ AudioStreamManager: Microphone permission denied")
                }
            }
        }
    }

    func stopStreaming() {
        guard isStreaming else { return }

        audioEngine.inputNode.removeTap(onBus: 0)
        audioEngine.stop()
        isStreaming = false
        currentDbLevel = -60.0

        // Deactivate audio session
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            print("⚠️ AudioStreamManager: Failed to deactivate session: \(error)")
        }

        print("🛑 AudioStreamManager: Stopped streaming")
    }

    // MARK: - Private Methods

    private func setupAndStartAudioEngine() {
        do {
            // Configure audio session for recording
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers])
            try session.setActive(true, options: [])

            // Get the input node (microphone)
            let inputNode = audioEngine.inputNode
            let inputFormat = inputNode.outputFormat(forBus: 0)

            // Create target format (16kHz mono Float32)
            guard let targetFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32,
                sampleRate: sampleRate,
                channels: 1,
                interleaved: false
            ) else {
                print("❌ AudioStreamManager: Failed to create target format")
                return
            }

            // Create format converter if needed
            let converter: AVAudioConverter?
            if inputFormat.sampleRate != sampleRate || inputFormat.channelCount != 1 {
                converter = AVAudioConverter(from: inputFormat, to: targetFormat)
                print("🔄 AudioStreamManager: Using converter from \(inputFormat.sampleRate)Hz/\(inputFormat.channelCount)ch to \(sampleRate)Hz/1ch")
            } else {
                converter = nil
            }

            // Install tap on input node
            inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, time in
                self?.processAudioBuffer(buffer, converter: converter, targetFormat: targetFormat)
            }

            // Start the engine
            try audioEngine.start()
            isStreaming = true

            print("🎙️ AudioStreamManager: Started streaming at \(sampleRate)Hz")
            print("   - Input format: \(inputFormat.sampleRate)Hz, \(inputFormat.channelCount) channels")
            print("   - Buffer size: \(bufferSize) frames")

        } catch {
            print("❌ AudioStreamManager: Failed to start: \(error.localizedDescription)")
        }
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, converter: AVAudioConverter?, targetFormat: AVAudioFormat) {
        // Convert to target format if needed
        let outputBuffer: AVAudioPCMBuffer

        if let converter = converter {
            guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: bufferSize) else {
                return
            }

            var error: NSError?
            let status = converter.convert(to: convertedBuffer, error: &error) { inNumPackets, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }

            if status == .error {
                print("⚠️ AudioStreamManager: Conversion error: \(error?.localizedDescription ?? "unknown")")
                return
            }

            outputBuffer = convertedBuffer
        } else {
            outputBuffer = buffer
        }

        // Extract Float32 samples
        guard let floatData = outputBuffer.floatChannelData?[0] else { return }
        let frameLength = Int(outputBuffer.frameLength)

        // Calculate RMS and dB level
        var sum: Float = 0
        for i in 0..<frameLength {
            let sample = floatData[i]
            sum += sample * sample
        }
        let rms = sqrt(sum / Float(frameLength))
        let db = 20 * log10(max(rms, 0.000001))  // Prevent log(0)
        currentDbLevel = max(-60, min(0, db))  // Clamp to [-60, 0]

        // Create data packet: [4 bytes dB level][PCM data]
        var packetData = Data()

        // Append dB level (4 bytes)
        var dbValue = currentDbLevel
        packetData.append(Data(bytes: &dbValue, count: 4))

        // Append PCM samples
        let pcmData = Data(bytes: floatData, count: frameLength * MemoryLayout<Float>.size)
        packetData.append(pcmData)

        // Send via WatchConnectivity if reachable
        sendAudioData(packetData)
    }

    private func sendAudioData(_ data: Data) {
        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            return
        }

        WCSession.default.sendMessageData(data, replyHandler: nil) { error in
            // Only log errors occasionally to avoid spam
            if arc4random_uniform(100) == 0 {
                print("⚠️ AudioStreamManager: Send error: \(error.localizedDescription)")
            }
        }
    }
}
