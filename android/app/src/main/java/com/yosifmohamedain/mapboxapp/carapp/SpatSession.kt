package com.yosifmohamedain.mapboxapp.carapp

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.navigation.NavigationManager
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

class SpatSession : Session() {

    // Required before AAOS will treat this app's audio as recognized
    // navigation guidance rather than arbitrary background media — see
    // VoiceGuidanceModule's USAGE_ASSISTANCE_NAVIGATION_GUIDANCE audio focus
    // request, which is what actually gates whether a given announce() call
    // is audible. Scoped to the car session's own lifetime (connect →
    // disconnect), not per-utterance — navigationStarted/Ended reflect
    // "a trip is in progress while connected", not each spoken cue.
    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                CarSessionKeepAliveService.start(carContext)
                try {
                    carContext.getCarService(NavigationManager::class.java).navigationStarted()
                } catch (e: Exception) {
                    // Host doesn't support the trip-in-progress signal — audio
                    // focus requests still work standalone.
                }
            }

            override fun onDestroy(owner: LifecycleOwner) {
                try {
                    carContext.getCarService(NavigationManager::class.java).navigationEnded()
                } catch (e: Exception) {
                }
                CarSessionKeepAliveService.stop(carContext)
            }
        })
    }

    override fun onCreateScreen(intent: Intent): Screen {
        return TimZoneScreen(carContext)
    }
}
