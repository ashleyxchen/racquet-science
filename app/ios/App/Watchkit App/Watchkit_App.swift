//
//  Watchkit_App.swift
//  Watchkit App
//
//  Created by Ashley Chen on 2025-11-30.
//

import AppIntents

struct Watchkit_App: AppIntent {
    static var title: LocalizedStringResource { "Watchkit App" }
    
    func perform() async throws -> some IntentResult {
        return .result()
    }
}
