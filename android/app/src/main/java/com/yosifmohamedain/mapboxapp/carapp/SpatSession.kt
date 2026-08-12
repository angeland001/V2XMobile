package com.yosifmohamedain.mapboxapp.carapp

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session

class SpatSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen {
        return PreemptionMessageScreen(carContext)
    }
}
