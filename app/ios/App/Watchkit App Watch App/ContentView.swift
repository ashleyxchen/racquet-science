//
//  ContentView.swift
//  Watchkit App Watch App
//
//  Created by Ashley Chen on 2025-11-30.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var motionManager = MotionManager.shared

    var body: some View {
        Group {
            switch motionManager.uiState {
            case .ready:
                ReadyView(motionManager: motionManager)

            case .remoteControlled:
                RemoteControlledView()

            case .calibrationStart(let message):
                CalibrationStartView(message: message)

            case .calibrationCountdown(let count):
                CalibrationCountdownView(count: count)

            case .calibrationSqueeze(let progress):
                CalibrationSqueezeView(progress: progress)

            case .calibrationDone(let maxForce):
                CalibrationDoneView(maxForce: maxForce)

            case .waitingForRecordingCommand:
                WaitingForRecordingView(motionManager: motionManager)

            case .recording:
                RecordingView(motionManager: motionManager)
            }
        }
    }
}

// MARK: - Ready State View

struct ReadyView: View {
    @ObservedObject var motionManager: MotionManager

    var body: some View {
        VStack(spacing: 20) {
            Text("Racket Science")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(.green)

//            Image(systemName: "tennis.racket")
//                .font(.system(size: 40))
//                .foregroundColor(.green)

            Text("Start a session in the mobile app")
                .font(.caption)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Remote Controlled View

struct RemoteControlledView: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "iphone")
                .font(.system(size: 30))
                .foregroundColor(.blue)

            Text("iOS Controlled")
                .font(.headline)

            Text("Control from iPhone app")
                .font(.caption)
                .foregroundColor(.gray)
        }
        .padding()
    }
}

// MARK: - Calibration Views

struct CalibrationStartView: View {
    let message: String

    var body: some View {
        VStack(spacing: 15) {
            Image(systemName: "hand.raised.fill")
                .font(.system(size: 40))
                .foregroundColor(.orange)

            Text(message)
                .font(.headline)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

struct CalibrationCountdownView: View {
    let count: Int

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.orange.opacity(0.2))
                .frame(width: 120, height: 120)

            Text("\(count)")
                .font(.system(size: 72, weight: .bold, design: .rounded))
                .foregroundColor(.orange)
        }
    }
}

struct CalibrationSqueezeView: View {
    let progress: Int

    var body: some View {
        VStack(spacing: 15) {
            Text("Squeeeeeeze!")
                .font(.headline)
                .foregroundColor(.orange)

            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.3), lineWidth: 8)
                    .frame(width: 100, height: 100)

                Circle()
                    .trim(from: 0, to: CGFloat(progress) / 5.0)
                    .stroke(Color.orange, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .frame(width: 100, height: 100)
                    .rotationEffect(.degrees(-90))

                Text("\(progress)")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.orange)
            }

            Text("Keep squeezing!")
                .font(.caption)
                .foregroundColor(.gray)
        }
        .padding()
    }
}

struct CalibrationDoneView: View {
    let maxForce: Double

    var body: some View {
        VStack(spacing: 15) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 50))
                .foregroundColor(.green)

            Text("All Done!")
                .font(.headline)

            VStack(spacing: 4) {
                Text("Peak Force")
                    .font(.caption)
                    .foregroundColor(.gray)
                Text(String(format: "%.1f N", maxForce))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.green)
            }
        }
        .padding()
    }
}

// MARK: - Recording Control Views

struct WaitingForRecordingView: View {
    @ObservedObject var motionManager: MotionManager

    var body: some View {
        VStack(spacing: 15) {
            Image(systemName: "video.fill")
                .font(.system(size: 30))
                .foregroundColor(.red)

            Text("Ready to Record")
                .font(.headline)

            Button(action: {
                motionManager.startRecordingFromWatch()
            }) {
                HStack {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 12, height: 12)
                    Text("Start")
                        .fontWeight(.semibold)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.red)
                .cornerRadius(20)
            }
            .buttonStyle(.plain)

            Text("Or start from iPhone")
                .font(.caption2)
                .foregroundColor(.gray)
        }
        .padding()
    }
}

struct RecordingView: View {
    @ObservedObject var motionManager: MotionManager
    @StateObject private var painNoteManager = PainNoteManager.shared

    var body: some View {
        ZStack {
            // Main content
            VStack(spacing: 6) {
                // Compact recording indicator
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 10, height: 10)

                    Text("Recording")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.red)

                    if motionManager.isRemoteControlled {
                        Image(systemName: "iphone")
                            .font(.system(size: 10))
                            .foregroundColor(.blue)
                    }
                }

                Spacer()
                    .frame(height: 4)

                // Pain Note Button
                Button(action: {
                    painNoteManager.setSessionStartTime(motionManager.recordingStartTime ?? Date())
                    painNoteManager.showNoteEntry()
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.bubble.fill")
                            .font(.system(size: 14))
                        Text("Pain Note")
                            .fontWeight(.semibold)
                            .font(.system(size: 15))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.orange)
                    .cornerRadius(12)
                }
                .buttonStyle(.plain)

                // Stop Button
                Button(action: {
                    if motionManager.isRemoteControlled {
                        motionManager.stopRecordingFromWatch()
                    } else {
                        motionManager.stopMotionUpdates(endWorkout: true)
                    }
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 12))
                        Text("Stop")
                            .fontWeight(.semibold)
                            .font(.system(size: 15))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.gray.opacity(0.8))
                    .cornerRadius(12)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            // Time remaining notification overlay
            if let notification = motionManager.timeRemainingNotification {
                VStack {
                    Spacer()

                    HStack {
                        Image(systemName: "clock.fill")
                            .font(.system(size: 14))
                        Text(notification)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .cornerRadius(20)
                    .shadow(radius: 4)

                    Spacer()
                }
                .transition(.scale.combined(with: .opacity))
                .animation(.easeInOut(duration: 0.3), value: motionManager.timeRemainingNotification)
            }
        }
        .sheet(isPresented: $painNoteManager.isShowingNoteEntry) {
            PainNoteEntryView(painNoteManager: painNoteManager)
        }
    }
}

// MARK: - Pain Note Entry View

struct PainNoteEntryView: View {
    @ObservedObject var painNoteManager: PainNoteManager
    @FocusState private var isTextFieldFocused: Bool

    var body: some View {
        VStack(spacing: 8) {
            // Text input with auto-focus for dictation
            TextField("Tap mic to speak...", text: $painNoteManager.noteText)
                .textFieldStyle(.plain)
                .padding(8)
                .background(Color.gray.opacity(0.2))
                .cornerRadius(8)
                .focused($isTextFieldFocused)

            // Pain level stepper - more responsive than wheel picker
            HStack(spacing: 12) {
                Button(action: {
                    if painNoteManager.painLevel > 1 {
                        painNoteManager.painLevel -= 1
                    }
                }) {
                    Image(systemName: "minus.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(painNoteManager.painLevel > 1 ? .orange : .gray)
                }
                .buttonStyle(.plain)
                .disabled(painNoteManager.painLevel <= 1)

                VStack(spacing: 2) {
                    Text("\(painNoteManager.painLevel)")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.orange)
                    Text("Pain Level")
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
                .frame(minWidth: 60)

                Button(action: {
                    if painNoteManager.painLevel < 10 {
                        painNoteManager.painLevel += 1
                    }
                }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(painNoteManager.painLevel < 10 ? .orange : .gray)
                }
                .buttonStyle(.plain)
                .disabled(painNoteManager.painLevel >= 10)
            }
            .padding(.vertical, 8)

            // Error message
            if let error = painNoteManager.error {
                Text(error)
                    .font(.caption2)
                    .foregroundColor(.red)
            }

            // Action buttons
            HStack(spacing: 10) {
                Button(action: {
                    painNoteManager.cancelNote()
                }) {
                    Text("Cancel")
                        .font(.caption)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color.gray)
                        .cornerRadius(15)
                }
                .buttonStyle(.plain)

                Button(action: {
                    painNoteManager.saveNote()
                }) {
                    Text("Save")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(painNoteManager.noteText.isEmpty ? Color.gray : Color.orange)
                        .cornerRadius(15)
                }
                .buttonStyle(.plain)
                .disabled(painNoteManager.noteText.isEmpty)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .onAppear {
            // Auto-focus the text field to show keyboard with dictation
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isTextFieldFocused = true
            }
        }
    }
}

#Preview {
    ContentView()
}
