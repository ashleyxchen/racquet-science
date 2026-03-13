//
//  PainNoteManager.swift
//  Watchkit App Watch App
//
//  Manages pain note creation and sending to iOS via WatchConnectivity.
//  Uses watchOS built-in text input with dictation support.
//

import Foundation
import WatchConnectivity
import Combine
class PainNoteManager: NSObject, ObservableObject {
    static let shared = PainNoteManager()

    // MARK: - Published Properties

    @Published var isShowingNoteEntry = false
    @Published var noteText = ""
    @Published var painLevel: Int = 5  // Default pain level 1-10
    @Published var error: String?

    // Session timing for relative timestamps
    private var sessionStartTime: Date?

    private override init() {
        super.init()
        print("🎤 PainNoteManager initialized")
    }

    // MARK: - Public Methods

    /// Set the session start time for calculating relative timestamps
    func setSessionStartTime(_ startTime: Date) {
        self.sessionStartTime = startTime
    }

    /// Show the pain note entry UI
    func showNoteEntry() {
        noteText = ""
        painLevel = 5
        error = nil
        isShowingNoteEntry = true
    }

    /// Hide the pain note entry UI
    func hideNoteEntry() {
        isShowingNoteEntry = false
    }

    /// Save and send the current pain note
    func saveNote() {
        guard !noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = "Please enter a note"
            return
        }

        sendPainNote()
        hideNoteEntry()
    }

    /// Cancel note entry
    func cancelNote() {
        noteText = ""
        painLevel = 5
        error = nil
        hideNoteEntry()
    }

    // MARK: - Private Methods

    private func sendPainNote() {
        let noteId = UUID().uuidString

        // Calculate relative time from session start
        let relativeTimeMs: Int64
        if let startTime = sessionStartTime {
            relativeTimeMs = Int64(Date().timeIntervalSince(startTime) * 1000)
        } else {
            relativeTimeMs = 0
        }

        let message: [String: Any] = [
            "type": "pain_note",
            "id": noteId,
            "relativeTimeMs": relativeTimeMs,
            "text": noteText.trimmingCharacters(in: .whitespacesAndNewlines),
            "painLevel": painLevel
        ]

        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            print("⚠️ PainNoteManager: WatchConnectivity not available, queuing note")
            // Use transferUserInfo for reliable delivery when not reachable
            WCSession.default.transferUserInfo(message)
            print("📤 PainNoteManager: Pain note queued via transferUserInfo")
            return
        }

        WCSession.default.sendMessage(message, replyHandler: { reply in
            print("✅ PainNoteManager: Pain note sent successfully: \(reply)")
        }) { error in
            print("⚠️ PainNoteManager: sendMessage failed, using transferUserInfo: \(error.localizedDescription)")
            // Fallback to transferUserInfo for reliable delivery
            WCSession.default.transferUserInfo(message)
        }

        print("📤 PainNoteManager: Sent pain note - id: \(noteId), text: \(self.noteText), painLevel: \(self.painLevel)")
    }
}
