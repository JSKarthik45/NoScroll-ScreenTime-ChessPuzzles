package com.jskarthik.noscrollscreentimechesspuzzles

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Listens for BOOT_COMPLETED to restart the ForegroundMonitorService
 * after the device is rebooted, ensuring blocking persists across restarts.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)
            val hasOnboarded = prefs.getBoolean("has_onboarded", false)
            val blockingEnabled = prefs.getBoolean("blocking_enabled", false)

            // Re-arm midnight reset after reboot so daily reset does not depend on app launch.
            if (hasOnboarded) {
                MidnightResetReceiver.scheduleMidnightAlarm(context)
            }
            
            // Only restart the service if blocking was enabled before reboot
            if (blockingEnabled) {
                val serviceIntent = Intent(context, ForegroundMonitorService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        }
    }
}
