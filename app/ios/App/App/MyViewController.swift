//
//  MyViewController.swift
//  App
//
//  Custom ViewController to register local Capacitor plugins
//

import UIKit
import Capacitor
import WebKit

class MyViewController: CAPBridgeViewController {

    override open func viewDidLoad() {
        super.viewDidLoad()

        // Set up for potential transparent webview (for camera preview)
        view.backgroundColor = .white  // Default white, will be changed when preview starts

        NSLog("🔌 MyViewController: viewDidLoad() - view setup complete")
    }

    override open func capacitorDidLoad() {
        NSLog("🔌 MyViewController: capacitorDidLoad() - registering plugins")
        bridge?.registerPluginInstance(WatchMotionPlugin())
        NSLog("🔌 MyViewController: WatchMotionPlugin registered")
        bridge?.registerPluginInstance(VideoRecordingPlugin())
        NSLog("🔌 MyViewController: VideoRecordingPlugin registered")

        // Configure webview for transparency support
        if let webView = self.webView {
            webView.isOpaque = false
            webView.backgroundColor = .clear
            webView.scrollView.backgroundColor = .clear
            NSLog("🔌 MyViewController: WebView configured for transparency")
        }
    }

    /// Make the webview transparent to show native views behind it
    func enableTransparentWebView() {
        view.backgroundColor = .clear

        if let webView = self.webView {
            webView.isOpaque = false
            webView.backgroundColor = .clear
            webView.scrollView.backgroundColor = .clear
        }

        NSLog("🔌 MyViewController: Transparent webview enabled")
    }

    /// Restore opaque webview
    func disableTransparentWebView() {
        view.backgroundColor = .white

        if let webView = self.webView {
            webView.isOpaque = true
            webView.backgroundColor = .white
        }

        NSLog("🔌 MyViewController: Opaque webview restored")
    }
}
