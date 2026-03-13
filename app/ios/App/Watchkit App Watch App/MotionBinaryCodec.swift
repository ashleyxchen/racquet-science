//
//  MotionBinaryCodec.swift
//  Watchkit App Watch App
//
//  Binary encoding for motion samples
//  Format: 26 bytes per sample (vs ~450 bytes JSON)
//
//  Packet Format:
//  Offset  Size  Type     Field
//  0       4     UInt32   sequenceNumber
//  4       4     UInt32   relativeTimeMs
//  8       2     Int16    accelX (×1000)
//  10      2     Int16    accelY (×1000)
//  12      2     Int16    accelZ (×1000)
//  14      2     Int16    gyroX (×100)
//  16      2     Int16    gyroY (×100)
//  18      2     Int16    gyroZ (×100)
//  20      2     Int16    roll (×1000)
//  22      2     Int16    pitch (×1000)
//  24      2     Int16    yaw (×1000)
//
//  Batch Format:
//  Offset  Size    Field
//  0       1       Batch type (0x01 = motion batch)
//  1       1       Sample count (1-255)
//  2       8       Session ID (first 8 chars as bytes)
//  10      N×26    Samples
//

import Foundation

/// Message types for binary protocol
enum MotionMessageType: UInt8 {
    case motionBatch = 0x01
    case recoveryRequest = 0x02
    case recoveryResponse = 0x03
    case acknowledgment = 0x04
}

/// Binary codec for motion samples
struct MotionBinaryCodec {
    /// Bytes per sample
    static let sampleSize = 26
    /// Batch header size (type + count + sessionId)
    static let batchHeaderSize = 10

    // MARK: - Encoding (Watch → iOS)

    /// Encode a batch of motion samples to binary data
    /// - Parameters:
    ///   - samples: Array of motion samples to encode
    ///   - sessionId: Session ID (first 8 chars used)
    /// - Returns: Binary data containing batch header and encoded samples
    static func encodeBatch(_ samples: [MotionSample], sessionId: String?) -> Data {
        var data = Data(capacity: batchHeaderSize + samples.count * sampleSize)

        // Header
        data.append(MotionMessageType.motionBatch.rawValue)
        data.append(UInt8(min(samples.count, 255)))

        // Session ID (8 bytes, padded with zeros)
        let sessionIdBytes = (sessionId ?? "").utf8.prefix(8)
        var idBytes = [UInt8](sessionIdBytes)
        while idBytes.count < 8 {
            idBytes.append(0)
        }
        data.append(contentsOf: idBytes)

        // Encode each sample
        for sample in samples {
            encodeSample(sample, into: &data)
        }

        return data
    }

    /// Encode a single sample into Data
    private static func encodeSample(_ sample: MotionSample, into data: inout Data) {
        // Sequence number (UInt32, big-endian)
        withUnsafeBytes(of: sample.sequence.bigEndian) { data.append(contentsOf: $0) }

        // Relative time (UInt32, big-endian)
        withUnsafeBytes(of: sample.relativeTimeMs.bigEndian) { data.append(contentsOf: $0) }

        // Accelerometer (Int16 × 1000)
        let accelX = Int16(clamping: Int(sample.accelX * 1000))
        let accelY = Int16(clamping: Int(sample.accelY * 1000))
        let accelZ = Int16(clamping: Int(sample.accelZ * 1000))
        withUnsafeBytes(of: accelX.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: accelY.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: accelZ.bigEndian) { data.append(contentsOf: $0) }

        // Gyroscope (Int16 × 100, rad/s)
        let gyroX = Int16(clamping: Int(sample.gyroX * 100))
        let gyroY = Int16(clamping: Int(sample.gyroY * 100))
        let gyroZ = Int16(clamping: Int(sample.gyroZ * 100))
        withUnsafeBytes(of: gyroX.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: gyroY.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: gyroZ.bigEndian) { data.append(contentsOf: $0) }

        // Orientation (Int16 × 1000, radians)
        let roll = Int16(clamping: Int(sample.roll * 1000))
        let pitch = Int16(clamping: Int(sample.pitch * 1000))
        let yaw = Int16(clamping: Int(sample.yaw * 1000))
        withUnsafeBytes(of: roll.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: pitch.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: yaw.bigEndian) { data.append(contentsOf: $0) }
    }

    // MARK: - Decoding (iOS receives from Watch)

    /// Decoded batch result
    struct DecodedBatch {
        let messageType: MotionMessageType
        let sampleCount: Int
        let sessionId: String
        let samples: [MotionSample]
    }

    /// Decode a binary batch to motion samples
    /// - Parameter data: Binary data received from Watch
    /// - Returns: Decoded batch or nil if invalid
    static func decodeBatch(_ data: Data) -> DecodedBatch? {
        guard data.count >= batchHeaderSize else { return nil }

        // Parse header
        guard let messageType = MotionMessageType(rawValue: data[0]) else { return nil }
        let sampleCount = Int(data[1])

        // Parse session ID
        let sessionIdBytes = data.subdata(in: 2..<10)
        let sessionId = String(data: sessionIdBytes, encoding: .utf8)?
            .trimmingCharacters(in: CharacterSet(charactersIn: "\0")) ?? ""

        // Validate data length
        let expectedLength = batchHeaderSize + sampleCount * sampleSize
        guard data.count >= expectedLength else { return nil }

        // Decode samples
        var samples: [MotionSample] = []
        samples.reserveCapacity(sampleCount)

        for i in 0..<sampleCount {
            let offset = batchHeaderSize + i * sampleSize
            if let sample = decodeSample(data, at: offset) {
                samples.append(sample)
            }
        }

        return DecodedBatch(
            messageType: messageType,
            sampleCount: sampleCount,
            sessionId: sessionId,
            samples: samples
        )
    }

    /// Decode a single sample from Data at given offset
    private static func decodeSample(_ data: Data, at offset: Int) -> MotionSample? {
        guard offset + sampleSize <= data.count else { return nil }

        // Read big-endian values
        let sequence = data.subdata(in: offset..<(offset + 4)).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }

        let relativeTimeMs = data.subdata(in: (offset + 4)..<(offset + 8)).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }

        // Accelerometer
        let accelXRaw = data.subdata(in: (offset + 8)..<(offset + 10)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }
        let accelYRaw = data.subdata(in: (offset + 10)..<(offset + 12)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }
        let accelZRaw = data.subdata(in: (offset + 12)..<(offset + 14)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }

        // Gyroscope
        let gyroXRaw = data.subdata(in: (offset + 14)..<(offset + 16)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }
        let gyroYRaw = data.subdata(in: (offset + 16)..<(offset + 18)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }
        let gyroZRaw = data.subdata(in: (offset + 18)..<(offset + 20)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }

        // Orientation
        let rollRaw = data.subdata(in: (offset + 20)..<(offset + 22)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }
        let pitchRaw = data.subdata(in: (offset + 22)..<(offset + 24)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }
        let yawRaw = data.subdata(in: (offset + 24)..<(offset + 26)).withUnsafeBytes {
            Int16(bigEndian: $0.load(as: Int16.self))
        }

        return MotionSample(
            sequence: sequence,
            relativeTimeMs: relativeTimeMs,
            accelX: Double(accelXRaw) / 1000.0,
            accelY: Double(accelYRaw) / 1000.0,
            accelZ: Double(accelZRaw) / 1000.0,
            gyroX: Double(gyroXRaw) / 100.0,
            gyroY: Double(gyroYRaw) / 100.0,
            gyroZ: Double(gyroZRaw) / 100.0,
            roll: Double(rollRaw) / 1000.0,
            pitch: Double(pitchRaw) / 1000.0,
            yaw: Double(yawRaw) / 1000.0
        )
    }

    // MARK: - Recovery Protocol

    /// Encode a recovery request (iOS → Watch)
    /// Requests samples in sequence range [fromSeq, toSeq]
    static func encodeRecoveryRequest(fromSeq: UInt32, toSeq: UInt32) -> Data {
        var data = Data(capacity: 9)
        data.append(MotionMessageType.recoveryRequest.rawValue)
        withUnsafeBytes(of: fromSeq.bigEndian) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: toSeq.bigEndian) { data.append(contentsOf: $0) }
        return data
    }

    /// Decode a recovery request
    static func decodeRecoveryRequest(_ data: Data) -> (fromSeq: UInt32, toSeq: UInt32)? {
        guard data.count >= 9, data[0] == MotionMessageType.recoveryRequest.rawValue else {
            return nil
        }

        let fromSeq = data.subdata(in: 1..<5).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }
        let toSeq = data.subdata(in: 5..<9).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }

        return (fromSeq, toSeq)
    }

    /// Encode an acknowledgment (iOS → Watch)
    /// Acknowledges receipt through given sequence number
    static func encodeAcknowledgment(throughSequence seq: UInt32) -> Data {
        var data = Data(capacity: 5)
        data.append(MotionMessageType.acknowledgment.rawValue)
        withUnsafeBytes(of: seq.bigEndian) { data.append(contentsOf: $0) }
        return data
    }

    /// Decode an acknowledgment
    static func decodeAcknowledgment(_ data: Data) -> UInt32? {
        guard data.count >= 5, data[0] == MotionMessageType.acknowledgment.rawValue else {
            return nil
        }

        return data.subdata(in: 1..<5).withUnsafeBytes {
            UInt32(bigEndian: $0.load(as: UInt32.self))
        }
    }
}
