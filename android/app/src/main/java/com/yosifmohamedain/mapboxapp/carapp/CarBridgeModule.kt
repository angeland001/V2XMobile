package com.yosifmohamedain.mapboxapp.carapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CarBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CarBridge"

    @ReactMethod
    fun updatePreemptionState(statusText: String, color: String, zoneName: String) {
        CarAppBridge.updatePreemption(
            CarAppBridge.PreemptionState(
                statusText = statusText,
                color = color,
                zoneName = zoneName.ifEmpty { null }
            )
        )
    }
}
