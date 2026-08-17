package com.yosifmohamedain.mapboxapp.carapp

import android.os.Handler
import android.os.Looper
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarIcon
import androidx.car.app.model.Header
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.yosifmohamedain.mapboxapp.R

// Driver-glance-only TIM zone screen: up to three color-coded badges — one
// per TIM category (safety/red, regulatory/yellow, informational/blue) —
// each showing the nearest zone in that category and its distance. Replaces
// this app's former preemption-status screen on Android Auto.
//
// Two independent staleness guards feed into this screen, both landing on
// the same "Status Unavailable" rendering so a lagging feed never displays
// confidently wrong badges on the dash:
//  1. JS-side: CarBridgeService.ts's keepalive (handles a stalled JS loop
//     while the bridge itself is still technically alive).
//  2. Native-side: the watchdog below, comparing wall-clock time against
//     CarAppBridge.TimZoneState.updatedAtMs (handles the bridge going
//     silent entirely — JS thread stalled, app backgrounded hard, etc.).
class TimZoneScreen(carContext: CarContext) : Screen(carContext) {

    private val mainHandler = Handler(Looper.getMainLooper())

    private val onStateChanged: () -> Unit = {
        mainHandler.post { invalidate() }
    }

    // Re-checks staleness even when no new bridge event arrives to trigger
    // onStateChanged — otherwise a silent bridge would leave the last good
    // badges on screen forever.
    private val staleWatchdog = object : Runnable {
        override fun run() {
            invalidate()
            mainHandler.postDelayed(this, WATCHDOG_INTERVAL_MS)
        }
    }

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                CarAppBridge.addTimZoneListener(onStateChanged)
                mainHandler.postDelayed(staleWatchdog, WATCHDOG_INTERVAL_MS)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                CarAppBridge.removeTimZoneListener(onStateChanged)
                mainHandler.removeCallbacks(staleWatchdog)
            }
        })
    }

    override fun onGetTemplate(): Template {
        val state = CarAppBridge.latestTimZones
        val bridgeSilent = System.currentTimeMillis() - state.updatedAtMs > BRIDGE_STALE_MS
        val badges = if (bridgeSilent) emptyList() else state.badges

        val header = Header.Builder().setTitle("V2X Zone Alerts").build()

        if (badges.isEmpty()) {
            val text = if (bridgeSilent) "Status Unavailable" else "No Zones Nearby"
            val icon = CarIcon.Builder(
                IconCompat.createWithResource(carContext, R.drawable.ic_status_idle)
            ).build()

            return MessageTemplate.Builder(text)
                .setHeader(header)
                .setIcon(icon)
                .build()
        }

        val itemListBuilder = ItemList.Builder()
        for (badge in badges) {
            val icon = CarIcon.Builder(
                IconCompat.createWithResource(carContext, iconResFor(badge.category))
            ).setTint(colorFor(badge.color)).build()

            itemListBuilder.addItem(
                Row.Builder()
                    .setTitle(badge.label)
                    .addText(badge.distanceText)
                    .setImage(icon)
                    .build()
            )
        }

        return ListTemplate.Builder()
            .setHeader(header)
            .setSingleList(itemListBuilder.build())
            .build()
    }

    private fun colorFor(name: String): CarColor = when (name) {
        "red" -> CarColor.RED
        "yellow" -> CarColor.YELLOW
        "blue" -> CarColor.BLUE
        else -> CarColor.DEFAULT
    }

    // One glyph per category, redundant with (not decorative of) the icon
    // color: a colorblind driver can't rely on red/yellow/blue alone, so
    // shape carries the same information color does.
    private fun iconResFor(category: String): Int = when (category) {
        "safety" -> R.drawable.ic_tim_safety
        "regulatory" -> R.drawable.ic_tim_regulatory
        "informational" -> R.drawable.ic_tim_informational
        else -> R.drawable.ic_status_idle
    }

    companion object {
        private const val WATCHDOG_INTERVAL_MS = 2000L
        // Looser than CarBridgeService.ts's KEEPALIVE_INTERVAL_MS (3000ms) so
        // the JS-side keepalive is the one that normally keeps this fresh;
        // this is the outer safety net for the bridge going silent altogether.
        private const val BRIDGE_STALE_MS = 8000L
    }
}
