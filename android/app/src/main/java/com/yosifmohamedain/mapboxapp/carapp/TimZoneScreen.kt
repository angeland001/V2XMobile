package com.yosifmohamedain.mapboxapp.carapp

import android.graphics.Color
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
            val tint = colorFor(badge.color)
            val icon = CarIcon.Builder(
                IconCompat.createWithResource(carContext, iconResFor(badge.category))
            ).setTint(tint).build()

            // Row titles in ListTemplate reject all spans (host throws on any
            // span, including ForegroundCarColorSpan, with an uncaught
            // IllegalArgumentException that crashes the whole car app process)
            // — plain text only here. addText() body lines DO support
            // ForegroundCarColorSpan (confirmed in Row.java's own javadoc).
            //
            // Deliberately NOT the category tint here — TimToast.tsx's own
            // convention (see its NEUTRAL comment) keeps category color
            // scoped to the icon only, never full body text, because a
            // category color (yellow especially) can read as low-contrast
            // against either theme's row background. SECONDARY_TEXT_COLOR is
            // a fixed, theme-aware neutral instead — distinct from the
            // title's default color, legible in both day and night car
            // themes, and the host falls back to its own default if this
            // fails its contrast check anyway.
            //
            // Severity is spelled out here ("Severity X/5") rather than via
            // setNumericDecoration — that API draws a bare number with no way
            // to attach a caption/label to it, which read as an unexplained
            // badge. Sharing the line with category+distance (instead of its
            // own line) keeps all three always visible — Row allows at most 2
            // body lines, and the second is reserved for durationText below.
            val severitySuffix = if (badge.severity > 0) "  ·  Severity ${badge.severity}/5" else ""
            val summaryLine = SpannableString(badge.categoryLabel + "  ·  " + badge.distanceText + severitySuffix).apply {
                setSpan(ForegroundCarColorSpan.create(SECONDARY_TEXT_COLOR), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // Title is the zone's specific sub-type (e.g. "Work Zone
            // Warning") rather than the top-level category — that now lives
            // on summaryLine above. The list's own on-screen order (not row
            // size — the host fixes that for every car app) is what surfaces
            // the most severe/closest zone first; see CarBridgeService.ts's
            // compareUrgency.
            val rowBuilder = Row.Builder()
                .setTitle(badge.label)
                .addText(summaryLine)
                // Row's second body line — always present (never blank; JS
                // falls back to "Active indefinitely" when the TIM has no
                // expiry) so the driver can always see how long a zone stays
                // active.
                .addText(badge.durationText)

            itemListBuilder.addItem(
                rowBuilder
                    .setImage(icon)
                    // Badges are otherwise persistent (no auto-expire) — a tap
                    // is the driver's own way to dismiss one. Forwarded to JS,
                    // which pushes back an updated badge set; the row actually
                    // disappearing happens through that same round trip every
                    // other state change already goes through, not here.
                    .setOnClickListener { CarAppBridge.notifyBadgeTapped(badge.category, badge.timId) }
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

        // Neutral secondary-text gray, not tied to TIM category — day/night
        // pair so it stays legible against both car theme backgrounds (the
        // host falls back to its own default if either fails contrast
        // checks). See the distanceText comment above for why this isn't the
        // category tint.
        private val SECONDARY_TEXT_COLOR = CarColor.createCustom(
            Color.parseColor("#5F6368"),
            Color.parseColor("#BDC1C6"),
        )
    }
}
