//
//  MotionBinaryCodecIOSTests.swift
//  AppTests
//
//  Unit tests for iOS-side MotionBinaryCodec - binary decoding for motion samples
//

import Testing
@testable import App
import Foundation

@Suite("MotionBinaryCodec iOS Tests")
struct MotionBinaryCodecIOSTests {

    // MARK: - Helper Functions

    /// Create a valid batch data with specified samples
    private func createBatchData(
        sampleCount: Int,
        sessionId: String = "test1234",
        startSeq: UInt32 = 0
    ) -> Data {
        var data = Data()

        // Header
        data.append(0x01) // motionBatch
        data.append(UInt8(min(sampleCount, 255)))

        // Session ID (8 bytes)
        let sessionIdBytes = sessionId.utf8.prefix(8)
        var idBytes = [UInt8](sessionIdBytes)
        while idBytes.count < 8 {
            idBytes.append(0)
        }
        data.append(contentsOf: idBytes)

        // Samples
        for i in 0..<sampleCount {
            appendSample(
                to: &data,
                seq: startSeq + UInt32(i),
                time: UInt32(i * 10),
                accelX: 0.123,
                accelY: -0.456,
                accelZ: 0.789,
                gyroX: 1.5,
                gyroY: -2.5,
                gyroZ: 3.5,
                roll: 0.1,
                pitch: 0.2,
                yaw: 0.3
            )
        }

        return data
    }

    private func appendSample(
        to data: inout Data,
        seq: UInt32,
        time: UInt32,
        accelX: Double,
        accelY: Double,
        accelZ: Double,
        gyroX: Double,
        gyroY: Double,
        gyroZ: Double,
        roll: Double,
        pitch: Double,
        yaw: Double
    ) {
        // Sequence (big-endian)
        withUnsafeBytes(of: seq.bigEndian) { data.append(contentsOf: $0) }

        // Time (big-endian)
        withUnsafeBytes(of: time.bigEndian) { data.append(contentsOf: $0) }

        // Accelerometer (Int16 × 1000)
        withUnsafeBytes(of: Int16(clamping: Int(accelX * 1000)).bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: Int16(clamping: Int(accelY * 1000)).bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: Int16(clamping: Int(accelZ * 1000)).bigEndian) { data.append(contentsOf: $0) }

        // Gyroscope (Int16 × 100)
        withUnsafeBytes(of: Int16(clamping: Int(gyroX * 100)).bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: Int16(clamping: Int(gyroY * 100)).bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: Int16(clamping: Int(gyroZ * 100)).bigEndian) { data.append(contentsOf: $0) }

        // Orientation (Int16 × 1000)
        withUnsafeBytes(of: Int16(clamping: Int(roll * 1000)).bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: Int16(clamping: Int(pitch * 1000)).bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: Int16(clamping: Int(yaw * 1000)).bigEndian) { data.append(contentsOf: $0) }
    }

    // MARK: - DecodeBatch Tests

    @Test("Decode batch - single sample")
    func testDecodeBatchSingleSample() {
        let data = createBatchData(sampleCount: 1)

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode batch")
            return
        }

        #expect(decoded.samples.count == 1)
        #expect(decoded.sampleCount == 1)
        #expect(decoded.messageType == .motionBatch)
        #expect(decoded.sessionId == "test1234")

        let sample = decoded.samples[0]
        #expect(sample.sequence == 0)
        #expect(sample.relativeTimeMs == 0)
        #expect(abs(sample.accelX - 0.123) < 0.001)
        #expect(abs(sample.accelY - (-0.456)) < 0.001)
        #expect(abs(sample.accelZ - 0.789) < 0.001)
        #expect(abs(sample.gyroX - 1.5) < 0.01)
        #expect(abs(sample.gyroY - (-2.5)) < 0.01)
        #expect(abs(sample.gyroZ - 3.5) < 0.01)
        #expect(abs(sample.roll - 0.1) < 0.001)
        #expect(abs(sample.pitch - 0.2) < 0.001)
        #expect(abs(sample.yaw - 0.3) < 0.001)
    }

    @Test("Decode batch - 10 samples")
    func testDecodeBatch10Samples() {
        let data = createBatchData(sampleCount: 10, startSeq: 100)

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode batch")
            return
        }

        #expect(decoded.samples.count == 10)
        #expect(decoded.sampleCount == 10)

        // Verify sequence numbers
        for i in 0..<10 {
            #expect(decoded.samples[i].sequence == 100 + UInt32(i))
            #expect(decoded.samples[i].relativeTimeMs == UInt32(i * 10))
        }
    }

    @Test("Decode batch - recovery response type")
    func testDecodeBatchRecoveryResponse() {
        var data = createBatchData(sampleCount: 1)
        // Change message type to recovery response
        data[0] = 0x03 // recoveryResponse

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode batch")
            return
        }

        #expect(decoded.messageType == .recoveryResponse)
        #expect(decoded.samples.count == 1)
    }

    // MARK: - DecodeInvalidData Tests

    @Test("Decode invalid data - empty")
    func testDecodeInvalidDataEmpty() {
        let decoded = MotionBinaryCodec.decodeBatch(Data())
        #expect(decoded == nil)
    }

    @Test("Decode invalid data - truncated header")
    func testDecodeInvalidDataTruncatedHeader() {
        let data = Data([0x01, 0x01, 0x00]) // Only 3 bytes
        let decoded = MotionBinaryCodec.decodeBatch(data)
        #expect(decoded == nil)
    }

    @Test("Decode invalid data - truncated samples")
    func testDecodeInvalidDataTruncatedSamples() {
        var data = Data()
        data.append(0x01) // motionBatch
        data.append(5) // Claims 5 samples
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0]) // Session ID
        // Only add 1 sample worth of data (26 bytes) instead of 5 × 26 = 130
        data.append(contentsOf: Array(repeating: UInt8(0), count: 26))

        let decoded = MotionBinaryCodec.decodeBatch(data)
        #expect(decoded == nil)
    }

    @Test("Decode invalid data - unknown message type")
    func testDecodeInvalidDataUnknownType() {
        var data = Data()
        data.append(0xAB) // Unknown type
        data.append(0) // 0 samples
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0]) // Session ID

        let decoded = MotionBinaryCodec.decodeBatch(data)
        #expect(decoded == nil)
    }

    // MARK: - EncodeRecoveryRequest Tests

    @Test("Encode recovery request - basic")
    func testEncodeRecoveryRequest() {
        let data = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: 100, toSeq: 200)

        #expect(data.count == 9)
        #expect(data[0] == 0x02) // recoveryRequest type

        // Verify fromSeq (big-endian)
        let fromSeq = data.subdata(in: 1..<5).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }
        #expect(fromSeq == 100)

        // Verify toSeq (big-endian)
        let toSeq = data.subdata(in: 5..<9).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }
        #expect(toSeq == 200)
    }

    @Test("Encode recovery request - boundary values")
    func testEncodeRecoveryRequestBoundary() {
        let dataMax = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: UInt32.max - 10, toSeq: UInt32.max)
        #expect(dataMax.count == 9)

        let dataZero = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: 0, toSeq: 0)
        #expect(dataZero.count == 9)
    }

    // MARK: - EncodeAcknowledgment Tests

    @Test("Encode acknowledgment - basic")
    func testEncodeAcknowledgment() {
        let data = MotionBinaryCodec.encodeAcknowledgment(throughSequence: 500)

        #expect(data.count == 5)
        #expect(data[0] == 0x04) // acknowledgment type

        // Verify sequence (big-endian)
        let seq = data.subdata(in: 1..<5).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }
        #expect(seq == 500)
    }

    @Test("Encode acknowledgment - boundary values")
    func testEncodeAcknowledgmentBoundary() {
        let dataMax = MotionBinaryCodec.encodeAcknowledgment(throughSequence: UInt32.max)
        let seq = dataMax.subdata(in: 1..<5).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }
        #expect(seq == UInt32.max)

        let dataZero = MotionBinaryCodec.encodeAcknowledgment(throughSequence: 0)
        let seqZero = dataZero.subdata(in: 1..<5).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }
        #expect(seqZero == 0)
    }

    // MARK: - NACK Decoding Tests

    @Test("NACK detection - valid NACK")
    func testIsNackValid() {
        var data = Data()
        data.append(0xFF) // NACK type
        data.append(contentsOf: [0, 0, 0, 100]) // fromSeq
        data.append(contentsOf: [0, 0, 0, 200]) // toSeq

        #expect(MotionBinaryCodec.isNack(data) == true)
    }

    @Test("NACK detection - not a NACK")
    func testIsNackInvalid() {
        var data = Data()
        data.append(0x01) // motionBatch, not NACK
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0])

        #expect(MotionBinaryCodec.isNack(data) == false)
    }

    @Test("NACK detection - too short")
    func testIsNackTooShort() {
        let data = Data([0xFF, 0x00, 0x00]) // Only 3 bytes
        #expect(MotionBinaryCodec.isNack(data) == false)
    }

    @Test("Decode NACK - basic")
    func testDecodeNack() {
        var data = Data()
        data.append(0xFF) // NACK type
        withUnsafeBytes(of: UInt32(100).bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: UInt32(200).bigEndian) { data.append(contentsOf: $0) }

        guard let decoded = MotionBinaryCodec.decodeNack(data) else {
            Issue.record("Failed to decode NACK")
            return
        }

        #expect(decoded.fromSeq == 100)
        #expect(decoded.toSeq == 200)
    }

    @Test("Decode NACK - invalid data returns nil")
    func testDecodeNackInvalid() {
        // Wrong type
        var wrongType = Data()
        wrongType.append(0x01) // Not NACK
        wrongType.append(contentsOf: [0, 0, 0, 100, 0, 0, 0, 200])
        #expect(MotionBinaryCodec.decodeNack(wrongType) == nil)

        // Too short
        let tooShort = Data([0xFF, 0x00, 0x00, 0x00])
        #expect(MotionBinaryCodec.decodeNack(tooShort) == nil)
    }

    // MARK: - Precision Tests

    @Test("Precision - accelerometer values")
    func testPrecisionAccelerometer() {
        var data = Data()
        data.append(0x01) // motionBatch
        data.append(1) // 1 sample
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0]) // Session ID

        // Create sample with known values
        appendSample(
            to: &data,
            seq: 0,
            time: 0,
            accelX: 1.234,
            accelY: -1.234,
            accelZ: 9.81,
            gyroX: 0, gyroY: 0, gyroZ: 0,
            roll: 0, pitch: 0, yaw: 0
        )

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let sample = decoded.samples[0]
        // Int16 × 1000 gives precision of 0.001
        #expect(abs(sample.accelX - 1.234) < 0.001)
        #expect(abs(sample.accelY - (-1.234)) < 0.001)
        #expect(abs(sample.accelZ - 9.81) < 0.001)
    }

    @Test("Precision - gyroscope values")
    func testPrecisionGyroscope() {
        var data = Data()
        data.append(0x01)
        data.append(1)
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0])

        appendSample(
            to: &data,
            seq: 0, time: 0,
            accelX: 0, accelY: 0, accelZ: 0,
            gyroX: 12.34,
            gyroY: -12.34,
            gyroZ: 100.5,
            roll: 0, pitch: 0, yaw: 0
        )

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let sample = decoded.samples[0]
        // Int16 × 100 gives precision of 0.01
        #expect(abs(sample.gyroX - 12.34) < 0.01)
        #expect(abs(sample.gyroY - (-12.34)) < 0.01)
        #expect(abs(sample.gyroZ - 100.5) < 0.01)
    }

    // MARK: - Session ID Tests

    @Test("Session ID - parsing")
    func testSessionIdParsing() {
        let data1 = createBatchData(sampleCount: 1, sessionId: "abcd1234")
        guard let decoded1 = MotionBinaryCodec.decodeBatch(data1) else {
            Issue.record("Failed to decode")
            return
        }
        #expect(decoded1.sessionId == "abcd1234")

        let data2 = createBatchData(sampleCount: 1, sessionId: "abc")
        guard let decoded2 = MotionBinaryCodec.decodeBatch(data2) else {
            Issue.record("Failed to decode")
            return
        }
        #expect(decoded2.sessionId == "abc")

        let data3 = createBatchData(sampleCount: 1, sessionId: "")
        guard let decoded3 = MotionBinaryCodec.decodeBatch(data3) else {
            Issue.record("Failed to decode")
            return
        }
        #expect(decoded3.sessionId == "")
    }

    // MARK: - Data Size Tests

    @Test("Data size constants")
    func testDataSizeConstants() {
        #expect(MotionBinaryCodec.sampleSize == 26)
        #expect(MotionBinaryCodec.batchHeaderSize == 10)
    }

    @Test("Data size - expected batch sizes")
    func testExpectedBatchSizes() {
        // 1 sample: 10 + 26 = 36 bytes
        let data1 = createBatchData(sampleCount: 1)
        #expect(data1.count == 36)

        // 10 samples: 10 + 260 = 270 bytes
        let data10 = createBatchData(sampleCount: 10)
        #expect(data10.count == 270)

        // 100 samples: 10 + 2600 = 2610 bytes
        let data100 = createBatchData(sampleCount: 100)
        #expect(data100.count == 2610)
    }

    // MARK: - Cross-Platform Compatibility Tests

    @Test("Cross-platform - big endian encoding verified")
    func testBigEndianEncoding() {
        var data = Data()
        data.append(0x01)
        data.append(1)
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0])

        // Create sample with sequence 0x01020304
        appendSample(
            to: &data,
            seq: 0x01020304,
            time: 0x05060708,
            accelX: 0, accelY: 0, accelZ: 0,
            gyroX: 0, gyroY: 0, gyroZ: 0,
            roll: 0, pitch: 0, yaw: 0
        )

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let sample = decoded.samples[0]
        #expect(sample.sequence == 0x01020304)
        #expect(sample.relativeTimeMs == 0x05060708)
    }
}
