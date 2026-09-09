package com.yosifmohamedain.mapboxapp.carapp

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray

class CarBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CarBridge"

    // Forwards a row tap on the Android Auto zone-alert screen (see
    // TimZoneScreen.kt -> CarAppBridge.notifyBadgeTapped) to JS as a plain
    // device event — CarBridgeService.ts listens for this to record the
    // dismissal and push back an updated badge set.
    private val tapListener: (category: String, timId: Int) -> Unit = { category, timId ->
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(
                "CarBridgeTimZoneTapped",
                Arguments.createMap().apply {
                    putString("category", category)
                    putInt("timId", timId)
                },
            )
    }

    init {
        CarAppBridge.addTapListener(tapListener)
    }

    override fun invalidate() {
        CarAppBridge.removeTapListener(tapListener)
        super.invalidate()
    }

    // badgesJson is a JSON array of {category, timId, color, label, categoryLabel,
    // distanceText, durationText, severity} — see CarBridgeService.ts. Passed as
    // a plain string rather than a ReadableArray since the shape is fixed and
    // small; keeps this module a thin, dependency-free relay.
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
                        timId = obj.getInt("timId"),
                        color = obj.getString("color"),
                        label = obj.getString("label"),
                        categoryLabel = obj.getString("categoryLabel"),
                        distanceText = obj.getString("distanceText"),
                        durationText = obj.getString("durationText"),
                        severity = obj.optInt("severity", 0),
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
