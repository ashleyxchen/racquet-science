//
//  MotionBinaryCodecTests.swift
//  Watchkit App Watch AppTests
//
//  Unit tests for MotionBinaryCodec - binary encoding/decoding for motion samples
//

import Testing
@testable import Watchkit_App_Watch_App
import Foundation

@Suite("MotionBinaryCodec Tests")
struct MotionBinaryCodecTests {

    // MARK: - Helper Functions

    private func makeSample(
        seq: UInt32 = 42,
        time: UInt32 = 1000,
        accelX: Double = 0.123,
        accelY: Double = -0.456,
        accelZ: Double = 0.789,
        gyroX: Double = 1.5,
        gyroY: Double = -2.5,
        gyroZ: Double = 3.5,
        roll: Double = 0.1,
        pitch: Double = 0.2,
        yaw: Double = 0.3
    ) -> MotionSample {
        MotionSample(
            sequence: seq,
            relativeTimeMs: time,
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
    }

    // MARK: - Single Sample Encode/Decode Tests

    @Test("Encode and decode single sample - roundtrip")
    func testEncodeDecode() {
        let sample = makeSample()

        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "test1234")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode batch")
            return
        }

        #expect(decoded.samples.count == 1)
        #expect(decoded.messageType == .motionBatch)
        #expect(decoded.sessionId == "test1234")

        let result = decoded.samples[0]
        #expect(result.sequence == 42)
        #expect(result.relativeTimeMs == 1000)

        // Check with precision tolerance (Int16 scaling)
        #expect(abs(result.accelX - 0.123) < 0.001)
        #expect(abs(result.accelY - (-0.456)) < 0.001)
        #expect(abs(result.accelZ - 0.789) < 0.001)
        #expect(abs(result.gyroX - 1.5) < 0.01)
        #expect(abs(result.gyroY - (-2.5)) < 0.01)
        #expect(abs(result.gyroZ - 3.5) < 0.01)
        #expect(abs(result.roll - 0.1) < 0.001)
        #expect(abs(result.pitch - 0.2) < 0.001)
        #expect(abs(result.yaw - 0.3) < 0.001)
    }

    // MARK: - Batch Encode/Decode Tests

    @Test("Encode and decode batch of 10 samples")
    func testBatchEncodeDecode() {
        var samples: [MotionSample] = []
        for i in 0..<10 {
            samples.append(makeSample(seq: UInt32(i), time: UInt32(i * 10)))
        }

        let data = MotionBinaryCodec.encodeBatch(samples, sessionId: "batch123")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode batch")
            return
        }

        #expect(decoded.samples.count == 10)
        #expect(decoded.sampleCount == 10)
        #expect(decoded.sessionId == "batch123")

        // Verify all samples decoded correctly
        for i in 0..<10 {
            #expect(decoded.samples[i].sequence == UInt32(i))
            #expect(decoded.samples[i].relativeTimeMs == UInt32(i * 10))
        }
    }

    @Test("Encode and decode maximum batch (255 samples)")
    func testMaxBatchSize() {
        var samples: [MotionSample] = []
        for i in 0..<255 {
            samples.append(makeSample(seq: UInt32(i)))
        }

        let data = MotionBinaryCodec.encodeBatch(samples, sessionId: "max")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode max batch")
            return
        }

        #expect(decoded.samples.count == 255)
        #expect(decoded.sampleCount == 255)
    }

    @Test("Encode empty batch")
    func testEmptyBatch() {
        let data = MotionBinaryCodec.encodeBatch([], sessionId: "empty")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode empty batch")
            return
        }

        #expect(decoded.samples.count == 0)
        #expect(decoded.sampleCount == 0)
    }

    // MARK: - Precision Loss Tests

    @Test("Precision loss - accelerometer values")
    func testAccelerometerPrecision() {
        // Test values near the limits of Int16 scaling (×1000)
        // Int16 range: -32768 to 32767
        // Mapped range: -32.768 to 32.767

        let sample = makeSample(accelX: 1.2345, accelY: -1.2345, accelZ: 0.0005)
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "prec")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let result = decoded.samples[0]

        // Accelerometer precision: ±0.001 (due to Int16 × 1000)
        #expect(abs(result.accelX - 1.234) < 0.001) // 1.2345 rounds to 1.234
        #expect(abs(result.accelY - (-1.234)) < 0.001)
        #expect(abs(result.accelZ - 0.0) < 0.001) // 0.0005 rounds to 0 or 0.001
    }

    @Test("Precision loss - gyroscope values")
    func testGyroscopePrecision() {
        // Gyroscope uses ×100 scaling
        // Int16 range: -32768 to 32767
        // Mapped range: -327.68 to 327.67 rad/s

        let sample = makeSample(gyroX: 12.345, gyroY: -12.345, gyroZ: 0.005)
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "prec")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let result = decoded.samples[0]

        // Gyroscope precision: ±0.01 (due to Int16 × 100)
        #expect(abs(result.gyroX - 12.34) < 0.01)
        #expect(abs(result.gyroY - (-12.34)) < 0.01)
        #expect(abs(result.gyroZ - 0.0) < 0.01)
    }

    @Test("Precision loss - orientation values")
    func testOrientationPrecision() {
        // Orientation uses ×1000 scaling (same as accelerometer)

        let sample = makeSample(roll: 3.14159, pitch: -1.5708, yaw: 0.0001)
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "prec")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let result = decoded.samples[0]

        #expect(abs(result.roll - 3.141) < 0.001)
        #expect(abs(result.pitch - (-1.570)) < 0.001)
        #expect(abs(result.yaw - 0.0) < 0.001)
    }

    // MARK: - Recovery Request Codec Tests

    @Test("Recovery request encode/decode")
    func testRecoveryRequestCodec() {
        let data = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: 100, toSeq: 200)

        guard let decoded = MotionBinaryCodec.decodeRecoveryRequest(data) else {
            Issue.record("Failed to decode recovery request")
            return
        }

        #expect(decoded.fromSeq == 100)
        #expect(decoded.toSeq == 200)
    }

    @Test("Recovery request - boundary values")
    func testRecoveryRequestBoundaryValues() {
        // Test with UInt32 max and min
        let dataMax = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: UInt32.max - 100, toSeq: UInt32.max)
        guard let decodedMax = MotionBinaryCodec.decodeRecoveryRequest(dataMax) else {
            Issue.record("Failed to decode max recovery request")
            return
        }
        #expect(decodedMax.fromSeq == UInt32.max - 100)
        #expect(decodedMax.toSeq == UInt32.max)

        let dataMin = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: 0, toSeq: 0)
        guard let decodedMin = MotionBinaryCodec.decodeRecoveryRequest(dataMin) else {
            Issue.record("Failed to decode min recovery request")
            return
        }
        #expect(decodedMin.fromSeq == 0)
        #expect(decodedMin.toSeq == 0)
    }

    // MARK: - Acknowledgment Codec Tests

    @Test("Acknowledgment encode/decode")
    func testAcknowledgmentCodec() {
        let data = MotionBinaryCodec.encodeAcknowledgment(throughSequence: 500)

        guard let decoded = MotionBinaryCodec.decodeAcknowledgment(data) else {
            Issue.record("Failed to decode acknowledgment")
            return
        }

        #expect(decoded == 500)
    }

    @Test("Acknowledgment - boundary values")
    func testAcknowledgmentBoundaryValues() {
        let dataMax = MotionBinaryCodec.encodeAcknowledgment(throughSequence: UInt32.max)
        guard let decodedMax = MotionBinaryCodec.decodeAcknowledgment(dataMax) else {
            Issue.record("Failed to decode max acknowledgment")
            return
        }
        #expect(decodedMax == UInt32.max)

        let dataZero = MotionBinaryCodec.encodeAcknowledgment(throughSequence: 0)
        guard let decodedZero = MotionBinaryCodec.decodeAcknowledgment(dataZero) else {
            Issue.record("Failed to decode zero acknowledgment")
            return
        }
        #expect(decodedZero == 0)
    }

    // MARK: - Invalid Data Tests

    @Test("Invalid data - empty data returns nil")
    func testDecodeEmptyData() {
        let decoded = MotionBinaryCodec.decodeBatch(Data())
        #expect(decoded == nil)
    }

    @Test("Invalid data - truncated header returns nil")
    func testDecodeTruncatedHeader() {
        let data = Data([0x01, 0x05]) // Only 2 bytes, header needs 10
        let decoded = MotionBinaryCodec.decodeBatch(data)
        #expect(decoded == nil)
    }

    @Test("Invalid data - truncated samples returns nil")
    func testDecodeTruncatedSamples() {
        // Create valid header claiming 5 samples but only include partial data
        var data = Data(capacity: 20)
        data.append(MotionMessageType.motionBatch.rawValue)
        data.append(5) // Claims 5 samples
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0]) // Session ID
        // Only add partial sample data (less than 5 * 26 = 130 bytes)
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) // 10 bytes

        let decoded = MotionBinaryCodec.decodeBatch(data)
        #expect(decoded == nil)
    }

    @Test("Invalid data - invalid message type returns nil")
    func testDecodeInvalidMessageType() {
        var data = Data(capacity: 10)
        data.append(0xAB) // Invalid message type
        data.append(0) // 0 samples
        data.append(contentsOf: [0, 0, 0, 0, 0, 0, 0, 0]) // Session ID

        let decoded = MotionBinaryCodec.decodeBatch(data)
        #expect(decoded == nil)
    }

    @Test("Invalid recovery request - too short")
    func testDecodeInvalidRecoveryRequest() {
        let data = Data([0x02, 0x00, 0x00]) // Only 3 bytes, needs 9
        let decoded = MotionBinaryCodec.decodeRecoveryRequest(data)
        #expect(decoded == nil)
    }

    @Test("Invalid recovery request - wrong message type")
    func testDecodeWrongTypeRecoveryRequest() {
        var data = Data(capacity: 9)
        data.append(0x01) // Wrong type (should be 0x02)
        data.append(contentsOf: [0, 0, 0, 100]) // fromSeq
        data.append(contentsOf: [0, 0, 0, 200]) // toSeq

        let decoded = MotionBinaryCodec.decodeRecoveryRequest(data)
        #expect(decoded == nil)
    }

    @Test("Invalid acknowledgment - too short")
    func testDecodeInvalidAcknowledgment() {
        let data = Data([0x04, 0x00]) // Only 2 bytes, needs 5
        let decoded = MotionBinaryCodec.decodeAcknowledgment(data)
        #expect(decoded == nil)
    }

    // MARK: - Session ID Tests

    @Test("Session ID - full 8 characters")
    func testSessionIdFull() {
        let sample = makeSample()
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "12345678")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        #expect(decoded.sessionId == "12345678")
    }

    @Test("Session ID - short ID is padded")
    func testSessionIdShort() {
        let sample = makeSample()
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "abc")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        #expect(decoded.sessionId == "abc")
    }

    @Test("Session ID - long ID is truncated")
    func testSessionIdLong() {
        let sample = makeSample()
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "123456789ABCDEF")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        #expect(decoded.sessionId == "12345678") // First 8 chars only
    }

    @Test("Session ID - nil produces empty string")
    func testSessionIdNil() {
        let sample = makeSample()
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: nil)

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        #expect(decoded.sessionId == "")
    }

    // MARK: - Boundary Value Tests

    @Test("Boundary values - zero values")
    func testZeroValues() {
        let sample = makeSample(
            seq: 0,
            time: 0,
            accelX: 0, accelY: 0, accelZ: 0,
            gyroX: 0, gyroY: 0, gyroZ: 0,
            roll: 0, pitch: 0, yaw: 0
        )
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "zero")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let result = decoded.samples[0]
        #expect(result.sequence == 0)
        #expect(result.relativeTimeMs == 0)
        #expect(result.accelX == 0)
        #expect(result.gyroX == 0)
        #expect(result.roll == 0)
    }

    @Test("Boundary values - maximum sequence and time")
    func testMaxSequenceAndTime() {
        let sample = makeSample(seq: UInt32.max, time: UInt32.max)
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "max")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let result = decoded.samples[0]
        #expect(result.sequence == UInt32.max)
        #expect(result.relativeTimeMs == UInt32.max)
    }

    @Test("Boundary values - clamping at Int16 limits")
    func testInt16Clamping() {
        // Values that exceed Int16 range should be clamped
        let sample = makeSample(
            accelX: 100.0, // × 1000 = 100000, exceeds Int16.max (32767)
            gyroX: 500.0   // × 100 = 50000, exceeds Int16.max
        )
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "clamp")

        guard let decoded = MotionBinaryCodec.decodeBatch(data) else {
            Issue.record("Failed to decode")
            return
        }

        let result = decoded.samples[0]
        // Should be clamped to Int16.max / divisor
        #expect(result.accelX == Double(Int16.max) / 1000.0)
        #expect(result.gyroX == Double(Int16.max) / 100.0)
    }

    // MARK: - Data Size Tests

    @Test("Data size - single sample batch")
    func testDataSizeSingleSample() {
        let sample = makeSample()
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "test")

        // Header (10) + 1 sample (26) = 36 bytes
        #expect(data.count == 36)
    }

    @Test("Data size - 10 sample batch")
    func testDataSize10Samples() {
        var samples: [MotionSample] = []
        for i in 0..<10 {
            samples.append(makeSample(seq: UInt32(i)))
        }
        let data = MotionBinaryCodec.encodeBatch(samples, sessionId: "test")

        // Header (10) + 10 samples (260) = 270 bytes
        #expect(data.count == 270)
    }

    @Test("Data size - recovery request")
    func testDataSizeRecoveryRequest() {
        let data = MotionBinaryCodec.encodeRecoveryRequest(fromSeq: 0, toSeq: 100)

        // Type (1) + fromSeq (4) + toSeq (4) = 9 bytes
        #expect(data.count == 9)
    }

    @Test("Data size - acknowledgment")
    func testDataSizeAcknowledgment() {
        let data = MotionBinaryCodec.encodeAcknowledgment(throughSequence: 100)

        // Type (1) + sequence (4) = 5 bytes
        #expect(data.count == 5)
    }

    // MARK: - Big Endian Tests

    @Test("Big endian - sequence number encoding")
    func testBigEndianSequence() {
        let sample = makeSample(seq: 0x01020304)
        let data = MotionBinaryCodec.encodeBatch([sample], sessionId: "test")

        // Sequence starts at offset 10 (after header)
        let seqBytes = Array(data[10..<14])
        #expect(seqBytes == [0x01, 0x02, 0x03, 0x04]) // Big endian
    }
}
