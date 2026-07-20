package com.yosifmohamedain.mapboxapp.carapp

object CarAppBridge {

    data class SpatState(
        val statusText: String,
        val color: String,
        val intersection: String?
    )

    @Volatile
    var latest: SpatState = SpatState(statusText = "NO SIGNAL", color = "#808080", intersection = null)
        private set

    private val listeners = mutableSetOf<() -> Unit>()

    fun update(state: SpatState) {
        latest = state
        synchronized(listeners) {
            listeners.toList()
        }.forEach { it() }
    }

    fun addListener(listener: () -> Unit) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: () -> Unit) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }
}
