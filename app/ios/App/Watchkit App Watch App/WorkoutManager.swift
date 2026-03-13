//
//  WorkoutManager.swift
//  Watchkit App Watch App
//
//  Manages HKWorkoutSession to keep the app alive during recording sessions.
//  This prevents watchOS from suspending the app when the screen turns off.
//

import Foundation
import HealthKit
import WatchKit
import Combine

class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var workoutBuilder: HKLiveWorkoutBuilder?

    @Published var isWorkoutActive = false
    @Published var hasHealthKitPermission = false

    private override init() {
        super.init()
        checkHealthKitAuthorization()
    }

    // MARK: - HealthKit Authorization

    private func checkHealthKitAuthorization() {
        // Check if HealthKit is available on this device
        guard HKHealthStore.isHealthDataAvailable() else {
            print("❌ WorkoutManager: HealthKit not available on this device")
            return
        }

        // We only need workout type permission - no need for heart rate, calories, etc.
        let workoutType = HKQuantityType.workoutType()

        healthStore.getRequestStatusForAuthorization(toShare: [workoutType], read: []) { status, error in
            DispatchQueue.main.async {
                if status == .unnecessary {
                    self.hasHealthKitPermission = true
                    print("✅ WorkoutManager: HealthKit permission already granted")
                }
            }
        }
    }

    func requestHealthKitPermission(completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            print("❌ WorkoutManager: HealthKit not available")
            completion(false)
            return
        }

        // Request permission for workout type only
        let workoutType = HKQuantityType.workoutType()

        healthStore.requestAuthorization(toShare: [workoutType], read: []) { success, error in
            DispatchQueue.main.async {
                self.hasHealthKitPermission = success
                if success {
                    print("✅ WorkoutManager: HealthKit permission granted")
                } else {
                    print("❌ WorkoutManager: HealthKit permission denied: \(error?.localizedDescription ?? "unknown")")
                }
                completion(success)
            }
        }
    }

    // MARK: - Workout Session Management

    /// Start a workout session to keep the app alive
    /// Call this when calibration begins or recording starts
    func startWorkoutSession() {
        guard !isWorkoutActive else {
            print("⚠️ WorkoutManager: Workout session already active")
            return
        }

        guard HKHealthStore.isHealthDataAvailable() else {
            print("❌ WorkoutManager: HealthKit not available, cannot start workout")
            return
        }

        // Create workout configuration for tennis
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .tennis
        configuration.locationType = .outdoor

        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            workoutBuilder = workoutSession?.associatedWorkoutBuilder()

            workoutSession?.delegate = self
            workoutBuilder?.delegate = self

            // Set data source for the builder
            workoutBuilder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)

            // Start the session and builder
            let startDate = Date()
            workoutSession?.startActivity(with: startDate)
            workoutBuilder?.beginCollection(withStart: startDate) { success, error in
                if success {
                    print("✅ WorkoutManager: Workout data collection started")
                } else {
                    print("⚠️ WorkoutManager: Failed to start data collection: \(error?.localizedDescription ?? "unknown")")
                }
            }

            DispatchQueue.main.async {
                self.isWorkoutActive = true
            }

            print("✅ WorkoutManager: Workout session started (Tennis)")

        } catch {
            print("❌ WorkoutManager: Failed to create workout session: \(error.localizedDescription)")
        }
    }

    /// Stop the workout session
    /// Call this when recording ends and post-calibration is complete
    func stopWorkoutSession(saveToHealth: Bool = true) {
        guard isWorkoutActive, let session = workoutSession else {
            print("⚠️ WorkoutManager: No active workout session to stop")
            return
        }

        // End the session
        session.end()

        // End data collection and optionally save
        let endDate = Date()
        workoutBuilder?.endCollection(withEnd: endDate) { success, error in
            if success {
                if saveToHealth {
                    self.workoutBuilder?.finishWorkout { workout, error in
                        if let workout = workout {
                            print("✅ WorkoutManager: Workout saved to Health: \(workout.duration)s")
                        } else {
                            print("⚠️ WorkoutManager: Failed to save workout: \(error?.localizedDescription ?? "unknown")")
                        }
                    }
                } else {
                    self.workoutBuilder?.discardWorkout()
                    print("✅ WorkoutManager: Workout discarded (not saved to Health)")
                }
            } else {
                print("⚠️ WorkoutManager: Failed to end data collection: \(error?.localizedDescription ?? "unknown")")
            }
        }

        DispatchQueue.main.async {
            self.isWorkoutActive = false
            self.workoutSession = nil
            self.workoutBuilder = nil
        }

        print("✅ WorkoutManager: Workout session stopped")
    }

    /// Pause the workout (if needed)
    func pauseWorkout() {
        workoutSession?.pause()
        print("⏸️ WorkoutManager: Workout paused")
    }

    /// Resume the workout (if needed)
    func resumeWorkout() {
        workoutSession?.resume()
        print("▶️ WorkoutManager: Workout resumed")
    }
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        print("🏃 WorkoutManager: Session state changed: \(fromState.rawValue) → \(toState.rawValue)")

        DispatchQueue.main.async {
            self.isWorkoutActive = (toState == .running)
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("❌ WorkoutManager: Session failed: \(error.localizedDescription)")

        DispatchQueue.main.async {
            self.isWorkoutActive = false
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        // We don't need to process any health data - just keeping the app alive
    }

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Not used
    }
}
