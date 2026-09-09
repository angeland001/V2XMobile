package com.yosifmohamedain.mapboxapp.carapp

object CarAppBridge {

    data class TimBadge(
        val category: String,
        // Which zone this badge is for — echoed back via notifyBadgeTapped so
        // the JS side (CarBridgeService.ts) can scope a dismiss to this
        // specific zone rather than the whole category.
        val timId: Int,
        val color: String,
        // The zone's specific sub-type (e.g. "Work Zone Warning") — this is
        // the row's title on screen.
        val label: String,
        // Top-level category (e.g. "Safety") — rendered on the row's
        // secondary line, since the title now carries the sub-type.
        val categoryLabel: String,
        val distanceText: String,
        // "Active until <date>" / "Active indefinitely", pre-formatted by
        // CarBridgeService.ts — TimZoneScreen.kt renders it verbatim.
        val durationText: String,
        // 1-5, same scale as SeverityDots elsewhere in the app. Drives
        // TimZoneScreen.kt's trailing numeral decoration.
        val severity: Int,
    )

    // updatedAtMs backs TimZoneScreen's own staleness watchdog: if the JS side
    // stops pushing entirely (not just a stale heartbeat, but the whole
    // bridge going silent — JS thread stalled, app backgrounded hard, etc.)
    // the screen must stop trusting this value on its own, without waiting
    // for another update that may never come.
    data class TimZoneState(
        val badges: List<TimBadge>,
        val updatedAtMs: Long = System.currentTimeMillis()
    )

    @Volatile
    var latestTimZones: TimZoneState = TimZoneState(badges = emptyList())
        private set

    private val timZoneListeners = mutableSetOf<() -> Unit>()

    fun updateTimZones(state: TimZoneState) {
        latestTimZones = state
        synchronized(timZoneListeners) {
            timZoneListeners.toList()
        }.forEach { it() }
    }

    fun addTimZoneListener(listener: () -> Unit) {
        synchronized(timZoneListeners) {
            timZoneListeners.add(listener)
        }
    }

    fun removeTimZoneListener(listener: () -> Unit) {
        synchronized(timZoneListeners) {
            timZoneListeners.remove(listener)
        }
    }

    // Fired by TimZoneScreen when the driver taps a badge row. Forwarded to
    // JS (CarBridgeModule) so CarBridgeService.ts can record the dismissal
    // and push back an updated (badge-removed) state — the actual removal
    // from screen happens through that normal push round trip, same as any
    // other state change, rather than this object owning any display state
    // itself.
    private val tapListeners = mutableSetOf<(category: String, timId: Int) -> Unit>()

    fun notifyBadgeTapped(category: String, timId: Int) {
        synchronized(tapListeners) {
            tapListeners.toList()
        }.forEach { it(category, timId) }
    }

    fun addTapListener(listener: (category: String, timId: Int) -> Unit) {
        synchronized(tapListeners) {
            tapListeners.add(listener)
        }
    }

    fun removeTapListener(listener: (category: String, timId: Int) -> Unit) {
        synchronized(tapListeners) {
            tapListeners.remove(listener)
        }
    }
}
