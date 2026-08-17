package com.yosifmohamedain.mapboxapp.carapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray

class CarBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CarBridge"

    // badgesJson is a JSON array of {category, color, label, distanceText} —
    // see CarBridgeService.ts. Passed as a plain string rather than a
    // ReadableArray since the shape is fixed and small; keeps this module a
    // thin, dependency-free relay.
    @ReactMethod
    fun updateTimZones(badgesJson: String) {
        val badges = mutableListOf<CarAppBridge.TimBadge>()
        try {
            val arr = JSONArray(badgesJson)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                badges.add(
                    CarAppBridge.TimBadge(
                        category = obj.getString("category"),
                        color = obj.getString("color"),
                        label = obj.getString("label"),
                        distanceText = obj.getString("distanceText"),
                    )
                )
            }
        } catch (e: Exception) {
            // Malformed payload — ignore this push, keep showing last-known-good state.
            return
        }
        CarAppBridge.updateTimZones(CarAppBridge.TimZoneState(badges = badges))
    }
}
