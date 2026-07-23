package com.yosifmohamedain.mapboxapp.carapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CarBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CarBridge"

    @ReactMethod
    fun updateSpatState(statusText: String, color: String, intersection: String) {
        CarAppBridge.update(
            CarAppBridge.SpatState(
                statusText = statusText,
                color = color,
                intersection = intersection.ifEmpty { null }
            )
        )
    }
}
