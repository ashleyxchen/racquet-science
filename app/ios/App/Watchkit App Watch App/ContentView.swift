//
//  ContentView.swift
//  Watchkit App Watch App
//
//  Created by Ashley Chen on 2025-11-30.
//

import SwiftUI

struct ContentView: View {
    @State private var isTracking = false

    var body: some View {
        VStack(spacing: 15) {
            // Status icon
            Image(systemName: isTracking ? "figure.walk.motion" : "figure.stand")
                .font(.system(size: 40))
                .foregroundColor(isTracking ? .green : .gray)

            // Status text
            Text(isTracking ? "Tracking" : "Ready")
                .font(.headline)

            // Start/Stop button
            Button(action: toggleTracking) {
                Text(isTracking ? "Stop" : "Start")
                    .font(.body)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(isTracking ? Color.red : Color.green)
                    .cornerRadius(20)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .onAppear {
            // Initialize MotionManager on app launch
            _ = MotionManager.shared
        }
    }

    private func toggleTracking() {
        isTracking.toggle()

        if isTracking {
            MotionManager.shared.startMotionUpdates()
        } else {
            MotionManager.shared.stopMotionUpdates()
        }
    }
}

#Preview {
    ContentView()
}
