//
//  BatchingMotionStreamer.swift
//  Watchkit App Watch App
//
//  Handles batching of motion samples and sending via WatchConnectivity
//  Batches 10 samples per message (100ms of data) sent at 10Hz
//  This results in LESS bandwidth than 10Hz JSON streaming
//

import Foundation
import WatchConnectivity

/// Handles batching and streaming of motion samples to iOS
/// - Collects samples at 100Hz
/// - Batches 10 samples per message
/// - Sends at 10Hz (same message rate as current 10Hz JSON)
/// - Uses binary encoding (270 bytes vs 450 bytes JSON)
class BatchingMotionStreamer {
    /// Samples per batch (100ms at 100Hz)
    static let batchSize = 10
    /// Batch interval in seconds
    static let batchInterval: TimeInterval = 0.1

    private var ringBuffer: MotionRingBuffer
    private var batchTimer: Timer?
    private var isStreaming = false
    private var currentSessionId: String?

    /// Sequence counter for samples
    private var sequenceCounter: UInt32 = 0

    /// Statistics for debugging
    private var batchesSent: Int = 0
    private var samplesPushed: Int = 0
    private var lastLogTime: Date = Date()

    /// Callback for when recovery is needed
    var onRecoveryRequest: ((_ fromSeq: UInt32, _ toSeq: UInt32) -> Void)?

    init(ringBuffer: MotionRingBuffer = MotionRingBuffer()) {
        self.ringBuffer = ringBuffer
    }

    // MARK: - Public API

    /// Start streaming motion data
    /// - Parameters:
    ///   - sessionId: Session ID to include in batches
    func startStreaming(sessionId: String?) {
        guard !isStreaming else {
            print("⚠️ BatchingMotionStreamer: Already streaming")
            return
        }

        isStreaming = true
        currentSessionId = sessionId
        sequenceCounter = 0
        batchesSent = 0
        samplesPushed = 0
        lastLogTime = Date()

        // Clear ring buffer
        ringBuffer.clear()

        // Start batch timer on main thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.batchTimer = Timer.scheduledTimer(
                withTimeInterval: BatchingMotionStreamer.batchInterval,
                repeats: true
            ) { [weak self] _ in
                self?.sendBatch()
            }
        }

        print("✅ BatchingMotionStreamer: Started streaming (sessionId: \(sessionId ?? "none"))")
    }

    /// Stop streaming
    func stopStreaming() {
        guard isStreaming else { return }

        isStreaming = false

        DispatchQueue.main.async { [weak self] in
            self?.batchTimer?.invalidate()
            self?.batchTimer = nil
        }

        let stats = ringBuffer.getStats()
        print("🛑 BatchingMotionStreamer: Stopped streaming")
        print("   - Samples pushed: \(samplesPushed)")
        print("   - Batches sent: \(batchesSent)")
        print("   - Buffer stats: count=\(stats.count), lowest=\(stats.lowest), highest=\(stats.highest)")

        currentSessionId = nil
    }

    /// Push a new motion sample (called at 100Hz)
    func pushSample(
        relativeTimeMs: UInt32,
        accelX: Double, accelY: Double, accelZ: Double,
        gyroX: Double, gyroY: Double, gyroZ: Double,
        roll: Double, pitch: Double, yaw: Double
    ) {
        guard isStreaming else { return }

        let sample = MotionSample(
            sequence: sequenceCounter,
            relativeTimeMs: relativeTimeMs,
            accelX: accelX,
            accelY: accelY,
            accelZ: accelZ,
            gyroX: gyroX,
            gyroY: gyroY,
            gyroZ: gyroZ,
            roll: roll,
            pitch: pitch,
            yaw: yaw
        )

        ringBuffer.push(sample)
        sequenceCounter += 1
        samplesPushed += 1

        // Log progress every 1000 samples (10 seconds at 100Hz)
        if samplesPushed % 1000 == 0 {
            let elapsed = Date().timeIntervalSince(lastLogTime)
            let rate = Double(samplesPushed) / elapsed
            print("📊 BatchingMotionStreamer: \(samplesPushed) samples pushed, rate: \(String(format: "%.1f", rate)) Hz")
        }
    }

    /// Handle acknowledgment from iOS
    func handleAcknowledgment(throughSequence seq: UInt32) {
        ringBuffer.acknowledge(throughSequence: seq)
    }

    /// Handle recovery request from iOS
    func handleRecoveryRequest(fromSeq: UInt32, toSeq: UInt32) {
        guard isStreaming else { return }

        // Check if requested range is still available
        if ringBuffer.isRangeAvailable(from: fromSeq, to: toSeq) {
            let samples = ringBuffer.getRange(from: fromSeq, to: toSeq)
            if !samples.isEmpty {
                sendRecoveryBatch(samples)
            } else {
                sendRecoveryNack(fromSeq: fromSeq, toSeq: toSeq)
            }
        } else {
            // Data no longer available
            sendRecoveryNack(fromSeq: fromSeq, toSeq: toSeq)
        }
    }

    // MARK: - Private

    /// Send a batch of samples to iOS
    private func sendBatch() {
        guard isStreaming,
              WCSession.default.activationState == .activated else {
            return
        }

        // Get the most recent samples for batching
        let result = ringBuffer.getUnacknowledgedSamples(limit: BatchingMotionStreamer.batchSize)
        let samples = result.samples

        guard !samples.isEmpty else { return }

        // Encode to binary
        let data = MotionBinaryCodec.encodeBatch(samples, sessionId: currentSessionId)

        // Send via sendMessageData (binary data)
        if WCSession.default.isReachable {
            WCSession.default.sendMessageData(data, replyHandler: nil) { error in
                // Only log errors occasionally to avoid spam
                if self.batchesSent % 50 == 0 {
                    print("⚠️ BatchingMotionStreamer: sendMessageData failed: \(error.localizedDescription)")
                }
            }
            batchesSent += 1

            // Log progress every 100 batches (10 seconds)
            if batchesSent % 100 == 0 {
                print("📤 BatchingMotionStreamer: Batch #\(batchesSent), samples=\(samples.count), bytes=\(data.count)")
            }
        } else {
            // iPhone not reachable - samples stay in ring buffer for recovery
            if batchesSent % 10 == 0 {
                print("⚠️ BatchingMotionStreamer: iPhone not reachable, keeping samples in buffer")
            }
        }
    }

    /// Send recovery batch (samples requested by iOS)
    private func sendRecoveryBatch(_ samples: [MotionSample]) {
        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            return
        }

        // Encode as recovery response (same format as regular batch, but type = 0x03)
        var data = Data(capacity: MotionBinaryCodec.batchHeaderSize + samples.count * MotionBinaryCodec.sampleSize)

        // Use recovery response type
        data.append(MotionMessageType.recoveryResponse.rawValue)
        data.append(UInt8(min(samples.count, 255)))

        // Session ID
        let sessionIdBytes = (currentSessionId ?? "").utf8.prefix(8)
        var idBytes = [UInt8](sessionIdBytes)
        while idBytes.count < 8 {
            idBytes.append(0)
        }
        data.append(contentsOf: idBytes)

        // Encode samples using same format
        for sample in samples {
            encodeSampleForRecovery(sample, into: &data)
        }

        WCSession.default.sendMessageData(data, replyHandler: nil) { error in
            print("❌ BatchingMotionStreamer: Recovery send failed: \(error.localizedDescription)")
        }

        print("📤 BatchingMotionStreamer: Sent recovery batch with \(samples.count) samples")
    }

    /// Send NACK when requested samples are no longer available
    private func sendRecoveryNack(fromSeq: UInt32, toSeq: UInt32) {
        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            return
        }

        // NACK format: type (1) + fromSeq (4) + toSeq (4)
        var data = Data(capacity: 9)
        data.append(0xFF)  // NACK type
        withUnsafeBytes(of: fromSeq.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: toSeq.bigEndian) { data.append(contentsOf: $0) }

        WCSession.default.sendMessageData(data, replyHandler: nil) { error in
            print("❌ BatchingMotionStreamer: NACK send failed: \(error.localizedDescription)")
        }

        print("⚠️ BatchingMotionStreamer: Sent NACK for seq \(fromSeq)-\(toSeq) (data expired)")
    }

    /// Encode a sample for recovery response (same format as regular batch)
    private func encodeSampleForRecovery(_ sample: MotionSample, into data: inout Data) {
        // Sequence number
        withUnsafeBytes(of: sample.sequence.bigEndian) { data.append(contentsOf: $0) }

        // Relative time
        withUnsafeBytes(of: sample.relativeTimeMs.bigEndian) { data.append(contentsOf: $0) }

        // Accelerometer
        let accelX = Int16(clamping: Int(sample.accelX * 1000))
        let accelY = Int16(clamping: Int(sample.accelY * 1000))
        let accelZ = Int16(clamping: Int(sample.accelZ * 1000))
        withUnsafeBytes(of: accelX.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: accelY.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: accelZ.bigEndian) { data.append(contentsOf: $0) }

        // Gyroscope
        let gyroX = Int16(clamping: Int(sample.gyroX * 100))
        let gyroY = Int16(clamping: Int(sample.gyroY * 100))
        let gyroZ = Int16(clamping: Int(sample.gyroZ * 100))
        withUnsafeBytes(of: gyroX.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: gyroY.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: gyroZ.bigEndian) { data.append(contentsOf: $0) }

        // Orientation
        let roll = Int16(clamping: Int(sample.roll * 1000))
        let pitch = Int16(clamping: Int(sample.pitch * 1000))
        let yaw = Int16(clamping: Int(sample.yaw * 1000))
        withUnsafeBytes(of: roll.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: pitch.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: yaw.bigEndian) { data.append(contentsOf: $0) }
    }

    /// Get current statistics
    func getStats() -> (samplesPushed: Int, batchesSent: Int, bufferStats: (count: Int, lowest: UInt32, highest: UInt32, capacity: Int)) {
        return (samplesPushed, batchesSent, ringBuffer.getStats())
    }
}
