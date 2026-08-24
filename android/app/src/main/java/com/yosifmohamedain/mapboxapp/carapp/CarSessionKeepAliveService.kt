package com.yosifmohamedain.mapboxapp.carapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.yosifmohamedain.mapboxapp.MainActivity
import com.yosifmohamedain.mapboxapp.R

// Keeps this app's process at foreground priority for as long as Android
// Auto is connected, so the RN JS thread isn't throttled by Android's
// background execution limits behind the car screen — that throttling is
// what stalls TimService's poll loop and VehicleDisplayViewModel's SDSM
// WebSocket the moment the phone Activity backgrounds (see the staleness
// comment on CarAppBridge.TimZoneState.updatedAtMs). Started/stopped by
// SpatSession alongside the car session's own connect/disconnect lifetime.
// Does no work itself — it exists purely to hold foreground priority and a
// mandatory visible notification (required by the OS for any foreground
// service); all the actual polling/streaming still happens in the existing
// JS services.
class CarSessionKeepAliveService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Android Auto session",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Keeps live zone and vehicle data updating while connected to Android Auto"
            }
            manager.createNotificationChannel(channel)
        }

        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("V2X Mobile is active")
            .setContentText("Keeping live zone and vehicle data updating while connected to Android Auto")
            .setSmallIcon(R.drawable.ic_status_idle)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "car_session_keep_alive"
        private const val NOTIFICATION_ID = 4201

        fun start(context: Context) {
            val intent = Intent(context, CarSessionKeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, CarSessionKeepAliveService::class.java))
        }
    }
}
