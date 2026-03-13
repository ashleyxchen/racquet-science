//
//  MotionRingBuffer.swift
//  Watchkit App Watch App
//
//  Thread-safe ring buffer for storing motion samples with sequence numbers
//  Used for recovery of missed samples during streaming
//

import Foundation

/// Single motion sample with sequence number for tracking
struct MotionSample {
    let sequence: UInt32
    let relativeTimeMs: UInt32
    let accelX: Double
    let accelY: Double
    let accelZ: Double
    let gyroX: Double
    let gyroY: Double
    let gyroZ: Double
    let roll: Double
    let pitch: Double
    let yaw: Double
}

/// Thread-safe ring buffer for motion samples
/// Capacity: 30,000 samples (5 minutes at 100Hz)
/// Memory: ~780KB (well within Watch RAM limits)
final class MotionRingBuffer {
    /// Default capacity: 30,000 samples = 5 minutes at 100Hz
    static let defaultCapacity: Int = 30_000

    private let capacity: Int
    private var buffer: [MotionSample?]
    private var head: Int = 0  // Write position (next sample goes here)
    private var tail: Int = 0  // Read position (oldest unacknowledged sample)
    private var count: Int = 0

    /// Lowest sequence number still in buffer
    private var lowestSequence: UInt32 = 0
    /// Highest sequence number in buffer
    private var highestSequence: UInt32 = 0

    /// Thread safety via dispatch queue
    private let queue = DispatchQueue(label: "com.app.motionringbuffer", qos: .userInitiated)

    init(capacity: Int = MotionRingBuffer.defaultCapacity) {
        self.capacity = capacity
        self.buffer = Array(repeating: nil, count: capacity)
    }

    /// Push a new sample to the buffer
    /// O(1) operation
    func push(_ sample: MotionSample) {
        queue.sync {
            buffer[head] = sample
            head = (head + 1) % capacity

            if count < capacity {
                count += 1
            } else {
                // Buffer is full, advance tail (discard oldest)
                tail = (tail + 1) % capacity
                lowestSequence = buffer[tail]?.sequence ?? lowestSequence
            }

            highestSequence = sample.sequence
            if count == 1 {
                lowestSequence = sample.sequence
            }
        }
    }

    /// Get samples by sequence range (inclusive)
    /// Used for recovery of missed samples
    /// Returns empty array if requested range is no longer in buffer
    func getRange(from startSeq: UInt32, to endSeq: UInt32) -> [MotionSample] {
        return queue.sync {
            var result: [MotionSample] = []

            // Check if requested range is still in buffer
            if startSeq < lowestSequence {
                // Requested samples have been overwritten
                return []
            }

            // Linear scan to find samples in range
            // Could optimize with index calculation but this is only called for recovery
            for i in 0..<count {
                let idx = (tail + i) % capacity
                if let sample = buffer[idx] {
                    if sample.sequence >= startSeq && sample.sequence <= endSeq {
                        result.append(sample)
                    }
                    if sample.sequence > endSeq {
                        break
                    }
                }
            }

            return result
        }
    }

    /// Peek the most recent N samples (for batching)
    /// Returns samples in order from oldest to newest
    func peekRecent(_ n: Int) -> [MotionSample] {
        return queue.sync {
            let actualCount = min(n, count)
            var result: [MotionSample] = []
            result.reserveCapacity(actualCount)

            // Get last N samples
            for i in (count - actualCount)..<count {
                let idx = (tail + i) % capacity
                if let sample = buffer[idx] {
                    result.append(sample)
                }
            }

            return result
        }
    }

    /// Get all samples since last acknowledgment (up to N samples)
    /// Returns samples and their sequence range
    func getUnacknowledgedSamples(limit: Int) -> (samples: [MotionSample], fromSeq: UInt32, toSeq: UInt32) {
        return queue.sync {
            let actualCount = min(limit, count)
            var samples: [MotionSample] = []
            samples.reserveCapacity(actualCount)

            var fromSeq: UInt32 = 0
            var toSeq: UInt32 = 0

            // Get oldest unacknowledged samples
            for i in 0..<actualCount {
                let idx = (tail + i) % capacity
                if let sample = buffer[idx] {
                    samples.append(sample)
                    if i == 0 { fromSeq = sample.sequence }
                    toSeq = sample.sequence
                }
            }

            return (samples, fromSeq, toSeq)
        }
    }

    /// Acknowledge receipt of samples through given sequence number
    /// Removes acknowledged samples from buffer
    func acknowledge(throughSequence seq: UInt32) {
        queue.sync {
            // Find how many samples to remove
            var removeCount = 0
            for i in 0..<count {
                let idx = (tail + i) % capacity
                if let sample = buffer[idx] {
                    if sample.sequence <= seq {
                        buffer[idx] = nil
                        removeCount += 1
                    } else {
                        break
                    }
                }
            }

            // Advance tail
            tail = (tail + removeCount) % capacity
            count -= removeCount

            // Update lowest sequence
            if count > 0 {
                lowestSequence = buffer[tail]?.sequence ?? lowestSequence
            }
        }
    }

    /// Clear all samples from the buffer
    func clear() {
        queue.sync {
            buffer = Array(repeating: nil, count: capacity)
            head = 0
            tail = 0
            count = 0
            lowestSequence = 0
            highestSequence = 0
        }
    }

    /// Current number of samples in buffer
    var sampleCount: Int {
        return queue.sync { count }
    }

    /// Check if a sequence range is still available in the buffer
    func isRangeAvailable(from startSeq: UInt32, to endSeq: UInt32) -> Bool {
        return queue.sync {
            return startSeq >= lowestSequence && endSeq <= highestSequence
        }
    }

    /// Get buffer statistics for debugging
    func getStats() -> (count: Int, lowest: UInt32, highest: UInt32, capacity: Int) {
        return queue.sync {
            return (count, lowestSequence, highestSequence, capacity)
        }
    }
}
