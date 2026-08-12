package com.yosifmohamedain.mapboxapp.carapp

import android.os.Handler
import android.os.Looper
import android.text.SpannableString
import android.text.Spanned
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarIcon
import androidx.car.app.model.ForegroundCarColorSpan
import androidx.car.app.model.Header
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.yosifmohamedain.mapboxapp.R

// Minimal, driver-glance-only preemption status screen: zone name as the
// header, a single color-coded status word as the body. Deliberately does
// not show TIM alerts or numeric SPaT phase — see PreemptionViewModel.ts's
// carStatusText/carStatusColor, which already collapse the full preemption
// state machine down to this screen's vocabulary.
//
// Two independent staleness guards feed into this screen, both landing on
// the same "Status Unavailable" / CarColor.DEFAULT rendering so a lagging
// feed never displays a confidently wrong status on the dash:
//  1. JS-side: PreemptionViewModel.feedStale, folded into the text/color
//     values pushed over the bridge (handles a stalled heartbeat while JS
//     keeps running).
//  2. Native-side: the watchdog below, comparing wall-clock time against
//     CarAppBridge.PreemptionState.updatedAtMs (handles the bridge going
//     silent entirely — JS thread stalled, app backgrounded hard, etc.).
class PreemptionMessageScreen(carContext: CarContext) : Screen(carContext) {

    private val mainHandler = Handler(Looper.getMainLooper())

    private val onStateChanged: () -> Unit = {
        mainHandler.post { invalidate() }
    }

    // Re-checks staleness even when no new bridge event arrives to trigger
    // onStateChanged — otherwise a silent bridge would leave the last good
    // status on screen forever.
    private val staleWatchdog = object : Runnable {
        override fun run() {
            invalidate()
            mainHandler.postDelayed(this, WATCHDOG_INTERVAL_MS)
        }
    }

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                CarAppBridge.addPreemptionListener(onStateChanged)
                mainHandler.postDelayed(staleWatchdog, WATCHDOG_INTERVAL_MS)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                CarAppBridge.removePreemptionListener(onStateChanged)
                mainHandler.removeCallbacks(staleWatchdog)
            }
        })
    }

    override fun onGetTemplate(): Template {
        val state = CarAppBridge.latestPreemption
        val bridgeSilent = System.currentTimeMillis() - state.updatedAtMs > BRIDGE_STALE_MS

        val displayText = if (bridgeSilent) "Status Unavailable" else state.statusText
        val displayColor = if (bridgeSilent) CarColor.DEFAULT else colorFor(state.color)

        val message = SpannableString(displayText)
        message.setSpan(
            ForegroundCarColorSpan.create(displayColor),
            0,
            displayText.length,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )

        val header = Header.Builder()
            .setTitle(state.zoneName ?: "V2X Preemption")
            .build()

        val displayColorName = if (bridgeSilent) "gray" else state.color
        val icon = CarIcon.Builder(
            IconCompat.createWithResource(carContext, iconResFor(displayColorName))
        )
            .setTint(displayColor)
            .build()

        return MessageTemplate.Builder(message)
            .setHeader(header)
            .setIcon(icon)
            .build()
    }

    private fun colorFor(name: String): CarColor = when (name) {
        "green" -> CarColor.GREEN
        "yellow" -> CarColor.YELLOW
        "red" -> CarColor.RED
        else -> CarColor.DEFAULT
    }

    // One glyph per CarColor bucket, redundant with (not decorative of) the
    // text color: a colorblind driver can't rely on red vs. green alone, so
    // shape carries the same information color does. Mirrors the exact
    // bucketing PreemptionViewModel.carStatusColor already collapses to —
    // no new states introduced, just a second channel for the ones that exist.
    private fun iconResFor(name: String): Int = when (name) {
        "green" -> R.drawable.ic_status_active
        "yellow" -> R.drawable.ic_status_pending
        "red" -> R.drawable.ic_status_denied
        else -> R.drawable.ic_status_idle
    }

    companion object {
        private const val WATCHDOG_INTERVAL_MS = 2000L
        // Looser than PreemptionViewModel.HEARTBEAT_STALE_MS (5000ms) so the
        // JS-side staleness check is the one that normally fires first; this
        // is the outer safety net for the bridge going silent altogether.
        private const val BRIDGE_STALE_MS = 8000L
    }
}
