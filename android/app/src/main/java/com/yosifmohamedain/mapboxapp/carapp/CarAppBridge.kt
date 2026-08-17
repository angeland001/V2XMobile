package com.yosifmohamedain.mapboxapp.carapp

object CarAppBridge {

    data class TimBadge(
        val category: String,
        val color: String,
        val label: String,
        val distanceText: String,
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
}
