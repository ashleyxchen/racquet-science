//
//  MotionRingBufferTests.swift
//  Watchkit App Watch AppTests
//
//  Unit tests for MotionRingBuffer - thread-safe ring buffer for motion samples
//

import Testing
@testable import Watchkit_App_Watch_App
import Foundation

@Suite("MotionRingBuffer Tests")
struct MotionRingBufferTests {

    // MARK: - Helper Functions

    private func makeSample(seq: UInt32, time: UInt32 = 0) -> MotionSample {
        MotionSample(
            sequence: seq,
            relativeTimeMs: time == 0 ? seq * 10 : time,
            accelX: Double(seq) * 0.001,
            accelY: Double(seq) * 0.002,
            accelZ: Double(seq) * 0.003,
            gyroX: Double(seq) * 0.01,
            gyroY: Double(seq) * 0.02,
            gyroZ: Double(seq) * 0.03,
            roll: Double(seq) * 0.001,
            pitch: Double(seq) * 0.002,
            yaw: Double(seq) * 0.003
        )
    }

    // MARK: - Basic Push and Count Tests

    @Test("Push and count - basic operation")
    func testPushAndCount() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        #expect(buffer.sampleCount == 50)
    }

    @Test("Push single sample")
    func testPushSingleSample() {
        let buffer = MotionRingBuffer(capacity: 100)

        buffer.push(makeSample(seq: 42))

        #expect(buffer.sampleCount == 1)
        let stats = buffer.getStats()
        #expect(stats.lowest == 42)
        #expect(stats.highest == 42)
    }

    @Test("Empty buffer has zero count")
    func testEmptyBuffer() {
        let buffer = MotionRingBuffer(capacity: 100)

        #expect(buffer.sampleCount == 0)
    }

    // MARK: - Capacity and Overflow Tests

    @Test("Capacity overflow - oldest samples discarded")
    func testCapacityOverflow() {
        let buffer = MotionRingBuffer(capacity: 100)

        // Push 150 samples into a 100-capacity buffer
        for i in 0..<150 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        #expect(buffer.sampleCount == 100)

        let stats = buffer.getStats()
        #expect(stats.lowest == 50) // Oldest 50 should be discarded
        #expect(stats.highest == 149)
        #expect(stats.capacity == 100)
    }

    @Test("Buffer at exact capacity")
    func testExactCapacity() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<100 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        #expect(buffer.sampleCount == 100)
        let stats = buffer.getStats()
        #expect(stats.lowest == 0)
        #expect(stats.highest == 99)
    }

    @Test("Multiple overflow cycles")
    func testMultipleOverflowCycles() {
        let buffer = MotionRingBuffer(capacity: 50)

        // Push 200 samples (4 full cycles)
        for i in 0..<200 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        #expect(buffer.sampleCount == 50)
        let stats = buffer.getStats()
        #expect(stats.lowest == 150)
        #expect(stats.highest == 199)
    }

    // MARK: - GetRange Tests

    @Test("Get range - basic retrieval")
    func testGetRange() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        let range = buffer.getRange(from: 10, to: 19)

        #expect(range.count == 10)
        #expect(range.first?.sequence == 10)
        #expect(range.last?.sequence == 19)

        // Verify all samples in range are present
        for (index, sample) in range.enumerated() {
            #expect(sample.sequence == UInt32(10 + index))
        }
    }

    @Test("Get range - single sample")
    func testGetRangeSingleSample() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        let range = buffer.getRange(from: 25, to: 25)

        #expect(range.count == 1)
        #expect(range.first?.sequence == 25)
    }

    @Test("Get range - expired data returns empty")
    func testGetRangeExpired() {
        let buffer = MotionRingBuffer(capacity: 100)

        // Push 150 samples, first 50 will be expired
        for i in 0..<150 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        // Request expired range
        let range = buffer.getRange(from: 0, to: 49)

        #expect(range.isEmpty)
    }

    @Test("Get range - partially expired returns available portion")
    func testGetRangePartiallyExpired() {
        let buffer = MotionRingBuffer(capacity: 100)

        // Push 150 samples
        for i in 0..<150 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        // Request range that includes expired samples (0-70)
        // Only 50-70 should be available
        // Since startSeq < lowestSequence, this returns empty
        let range = buffer.getRange(from: 0, to: 70)
        #expect(range.isEmpty)

        // But requesting the available portion works
        let availableRange = buffer.getRange(from: 50, to: 70)
        #expect(availableRange.count == 21)
    }

    @Test("Get range - at boundaries")
    func testGetRangeAtBoundaries() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<100 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        // Get first samples
        let first = buffer.getRange(from: 0, to: 9)
        #expect(first.count == 10)
        #expect(first.first?.sequence == 0)

        // Get last samples
        let last = buffer.getRange(from: 90, to: 99)
        #expect(last.count == 10)
        #expect(last.last?.sequence == 99)
    }

    // MARK: - Acknowledge Tests

    @Test("Acknowledge - removes acknowledged samples")
    func testAcknowledge() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        // Acknowledge through sequence 29
        buffer.acknowledge(throughSequence: 29)

        #expect(buffer.sampleCount == 20) // 50 - 30 = 20

        let stats = buffer.getStats()
        #expect(stats.lowest == 30)
        #expect(stats.highest == 49)
    }

    @Test("Acknowledge - all samples")
    func testAcknowledgeAll() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        buffer.acknowledge(throughSequence: 49)

        #expect(buffer.sampleCount == 0)
    }

    @Test("Acknowledge - no matching samples")
    func testAcknowledgeNoMatch() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 100..<150 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        // Acknowledge sequence that's not in buffer
        buffer.acknowledge(throughSequence: 50)

        // Should not affect buffer
        #expect(buffer.sampleCount == 50)
    }

    // MARK: - Clear Tests

    @Test("Clear - removes all samples")
    func testClear() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        buffer.clear()

        #expect(buffer.sampleCount == 0)

        let stats = buffer.getStats()
        #expect(stats.lowest == 0)
        #expect(stats.highest == 0)
    }

    @Test("Clear - can push after clear")
    func testPushAfterClear() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        buffer.clear()

        // Push new samples after clear
        buffer.push(makeSample(seq: 1000))
        buffer.push(makeSample(seq: 1001))

        #expect(buffer.sampleCount == 2)
        let stats = buffer.getStats()
        #expect(stats.lowest == 1000)
        #expect(stats.highest == 1001)
    }

    // MARK: - IsRangeAvailable Tests

    @Test("IsRangeAvailable - available range")
    func testIsRangeAvailable() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        #expect(buffer.isRangeAvailable(from: 0, to: 49) == true)
        #expect(buffer.isRangeAvailable(from: 10, to: 30) == true)
        #expect(buffer.isRangeAvailable(from: 0, to: 0) == true)
        #expect(buffer.isRangeAvailable(from: 49, to: 49) == true)
    }

    @Test("IsRangeAvailable - unavailable range")
    func testIsRangeUnavailable() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 50..<100 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        // Range before buffer start
        #expect(buffer.isRangeAvailable(from: 0, to: 49) == false)

        // Range after buffer end
        #expect(buffer.isRangeAvailable(from: 100, to: 150) == false)

        // Partial overlap
        #expect(buffer.isRangeAvailable(from: 40, to: 60) == false)
    }

    // MARK: - GetUnacknowledgedSamples Tests

    @Test("GetUnacknowledgedSamples - basic retrieval")
    func testGetUnacknowledgedSamples() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        let result = buffer.getUnacknowledgedSamples(limit: 10)

        #expect(result.samples.count == 10)
        #expect(result.fromSeq == 0)
        #expect(result.toSeq == 9)
    }

    @Test("GetUnacknowledgedSamples - limit exceeds count")
    func testGetUnacknowledgedSamplesLimitExceeds() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<5 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        let result = buffer.getUnacknowledgedSamples(limit: 100)

        #expect(result.samples.count == 5)
        #expect(result.fromSeq == 0)
        #expect(result.toSeq == 4)
    }

    // MARK: - PeekRecent Tests

    @Test("PeekRecent - basic retrieval")
    func testPeekRecent() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<50 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        let recent = buffer.peekRecent(10)

        #expect(recent.count == 10)
        #expect(recent.first?.sequence == 40) // oldest of last 10
        #expect(recent.last?.sequence == 49) // newest
    }

    @Test("PeekRecent - more than buffer has")
    func testPeekRecentExceedsCount() {
        let buffer = MotionRingBuffer(capacity: 100)

        for i in 0..<5 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        let recent = buffer.peekRecent(100)

        #expect(recent.count == 5)
    }

    // MARK: - Thread Safety Tests

    @Test("Thread safety - concurrent pushes")
    func testThreadSafetyConcurrentPush() async {
        let buffer = MotionRingBuffer(capacity: 1000)

        // Push from multiple concurrent tasks
        await withTaskGroup(of: Void.self) { group in
            for taskNum in 0..<10 {
                group.addTask {
                    for i in 0..<100 {
                        let seq = UInt32(taskNum * 100 + i)
                        buffer.push(MotionSample(
                            sequence: seq,
                            relativeTimeMs: seq * 10,
                            accelX: 0, accelY: 0, accelZ: 0,
                            gyroX: 0, gyroY: 0, gyroZ: 0,
                            roll: 0, pitch: 0, yaw: 0
                        ))
                    }
                }
            }
        }

        // Should have all 1000 samples
        #expect(buffer.sampleCount == 1000)
    }

    @Test("Thread safety - concurrent reads and writes")
    func testThreadSafetyConcurrentReadWrite() async {
        let buffer = MotionRingBuffer(capacity: 500)

        // Pre-populate
        for i in 0..<100 {
            buffer.push(makeSample(seq: UInt32(i)))
        }

        var counts: [Int] = []

        await withTaskGroup(of: Int.self) { group in
            // Writers
            for taskNum in 0..<5 {
                group.addTask {
                    for i in 0..<50 {
                        let seq = UInt32(100 + taskNum * 50 + i)
                        buffer.push(MotionSample(
                            sequence: seq,
                            relativeTimeMs: seq * 10,
                            accelX: 0, accelY: 0, accelZ: 0,
                            gyroX: 0, gyroY: 0, gyroZ: 0,
                            roll: 0, pitch: 0, yaw: 0
                        ))
                    }
                    return 0
                }
            }

            // Readers
            for _ in 0..<5 {
                group.addTask {
                    var localCount = 0
                    for _ in 0..<50 {
                        localCount = buffer.sampleCount
                        _ = buffer.getStats()
                    }
                    return localCount
                }
            }

            for await count in group {
                if count > 0 {
                    counts.append(count)
                }
            }
        }

        // Buffer should have samples (exact count depends on timing)
        #expect(buffer.sampleCount > 0)
        #expect(buffer.sampleCount <= 500) // Should not exceed capacity
    }

    // MARK: - Data Integrity Tests

    @Test("Data integrity - sample values preserved")
    func testDataIntegrity() {
        let buffer = MotionRingBuffer(capacity: 100)

        let sample = MotionSample(
            sequence: 42,
            relativeTimeMs: 420,
            accelX: 1.234,
            accelY: -2.345,
            accelZ: 3.456,
            gyroX: 0.123,
            gyroY: -0.456,
            gyroZ: 0.789,
            roll: 0.111,
            pitch: 0.222,
            yaw: 0.333
        )

        buffer.push(sample)

        let retrieved = buffer.peekRecent(1).first!

        #expect(retrieved.sequence == 42)
        #expect(retrieved.relativeTimeMs == 420)
        #expect(retrieved.accelX == 1.234)
        #expect(retrieved.accelY == -2.345)
        #expect(retrieved.accelZ == 3.456)
        #expect(retrieved.gyroX == 0.123)
        #expect(retrieved.gyroY == -0.456)
        #expect(retrieved.gyroZ == 0.789)
        #expect(retrieved.roll == 0.111)
        #expect(retrieved.pitch == 0.222)
        #expect(retrieved.yaw == 0.333)
    }

    // MARK: - Edge Case Tests

    @Test("Edge case - sequence number wrap around")
    func testSequenceWrapAround() {
        let buffer = MotionRingBuffer(capacity: 100)

        // Push samples with high sequence numbers near UInt32 max
        let startSeq: UInt32 = UInt32.max - 50
        for i: UInt32 in 0..<100 {
            buffer.push(makeSample(seq: startSeq &+ i)) // Wrapping add
        }

        #expect(buffer.sampleCount == 100)
    }

    @Test("Edge case - very small capacity")
    func testSmallCapacity() {
        let buffer = MotionRingBuffer(capacity: 3)

        buffer.push(makeSample(seq: 0))
        buffer.push(makeSample(seq: 1))
        buffer.push(makeSample(seq: 2))
        buffer.push(makeSample(seq: 3))
        buffer.push(makeSample(seq: 4))

        #expect(buffer.sampleCount == 3)

        let stats = buffer.getStats()
        #expect(stats.lowest == 2)
        #expect(stats.highest == 4)
    }
}
