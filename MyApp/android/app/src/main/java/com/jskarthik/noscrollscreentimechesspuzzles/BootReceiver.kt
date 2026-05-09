package com.jskarthik.noscrollscreentimechesspuzzles

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Listens for BOOT_COMPLETED to restart the ForegroundMonitorService
 * after the device is rebooted, ensuring blocking persists across restarts.
 *
 * Key fix: performs a new-day check so that even if blocking_enabled was
 * false (goal completed yesterday), blocking is re-enabled for the new day.
 * Also re-schedules the midnight alarm which is lost during reboot.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != "com.htc.intent.action.QUICKBOOT_POWERON") {
            return
        }

        try {
            val prefs = context.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)

            // Only proceed if the user has completed onboarding
            val hasOnboarded = prefs.getBoolean("has_onboarded", false)
            if (!hasOnboarded) return

            // --- New-day detection ---
            // If it's a new day compared to the stored date, reset the daily count
            // and re-enable blocking regardless of the old blocking_enabled flag.
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val storedDate = prefs.getString("today_date", null)

            if (storedDate != today) {
                // New day: reset count and force-enable blocking
                prefs.edit()
                    .putString("today_date", today)
                    .putInt("today_count", 0)
                    .putBoolean("blocking_enabled", true)
                    .apply()
            }

            // Re-schedule the midnight alarm (it is lost during reboot)
            MidnightResetReceiver.scheduleMidnightAlarm(context)

            // Start the foreground service if blocking is enabled
            // (either it was already enabled, or we just enabled it above)
            val blockingEnabled = prefs.getBoolean("blocking_enabled", false)
            if (blockingEnabled) {
                val serviceIntent = Intent(context, ForegroundMonitorService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        } catch (e: Exception) {
            // Ignore exceptions such as IllegalStateException on some devices
            // if trying to read SharedPreferences from locked storage
            // before the user has unlocked the device. The regular BOOT_COMPLETED
            // broadcast will fire again once the user unlocks.
        }
    }
}
