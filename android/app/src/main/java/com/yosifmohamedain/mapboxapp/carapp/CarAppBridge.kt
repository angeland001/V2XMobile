package com.yosifmohamedain.mapboxapp.carapp

object CarAppBridge {

    // updatedAtMs backs PreemptionMessageScreen's own staleness watchdog: if
    // the JS side stops pushing entirely (not just a stale heartbeat, but the
    // whole bridge going silent — JS thread stalled, app backgrounded hard,
    // etc.) the screen must stop trusting this value on its own, without
    // waiting for another update that may never come.
    data class PreemptionState(
        val statusText: String,
        val color: String,
        val zoneName: String?,
        val updatedAtMs: Long = System.currentTimeMillis()
    )

    @Volatile
    var latestPreemption: PreemptionState =
        PreemptionState(statusText = "No Active Zone", color = "gray", zoneName = null)
        private set

    private val preemptionListeners = mutableSetOf<() -> Unit>()

    fun updatePreemption(state: PreemptionState) {
        latestPreemption = state
        synchronized(preemptionListeners) {
            preemptionListeners.toList()
        }.forEach { it() }
    }

    fun addPreemptionListener(listener: () -> Unit) {
        synchronized(preemptionListeners) {
            preemptionListeners.add(listener)
        }
    }

    fun removePreemptionListener(listener: () -> Unit) {
        synchronized(preemptionListeners) {
            preemptionListeners.remove(listener)
        }
    }
}
