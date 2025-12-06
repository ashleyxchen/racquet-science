#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WatchMotionPlugin, "WatchMotion",
    CAP_PLUGIN_METHOD(getMotionData, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isWatchConnected, CAPPluginReturnPromise);
)
