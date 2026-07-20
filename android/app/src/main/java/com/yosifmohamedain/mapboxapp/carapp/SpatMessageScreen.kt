package com.yosifmohamedain.mapboxapp.carapp

import android.os.Handler
import android.os.Looper
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Header
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

class SpatMessageScreen(carContext: CarContext) : Screen(carContext) {

    private val mainHandler = Handler(Looper.getMainLooper())

    private val onStateChanged: () -> Unit = {
        mainHandler.post { invalidate() }
    }

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                CarAppBridge.addListener(onStateChanged)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                CarAppBridge.removeListener(onStateChanged)
            }
        })
    }

    override fun onGetTemplate(): Template {
        val state = CarAppBridge.latest
        val header = Header.Builder()
            .setTitle(state.intersection ?: "No Zone")
            .build()

        return MessageTemplate.Builder(state.statusText)
            .setHeader(header)
            .build()
    }
}
