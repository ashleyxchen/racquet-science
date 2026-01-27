//
//  MyViewController.swift
//  App
//
//  Custom ViewController to register local Capacitor plugins
//

import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        NSLog("🔌 MyViewController: capacitorDidLoad() - registering plugins")
        bridge?.registerPluginInstance(WatchMotionPlugin())
        NSLog("🔌 MyViewController: WatchMotionPlugin registered")
    }
}
