package com.jskarthik.noscrollscreentimechesspuzzles

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Listens for boot/app-update/time-change events to keep midnight reset scheduling
 * and blocking state consistent without requiring app launch.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        val supported = action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == Intent.ACTION_DATE_CHANGED ||
            action == Intent.ACTION_TIME_CHANGED ||
            action == Intent.ACTION_TIMEZONE_CHANGED
        if (!supported) return

        val prefs = context.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)
        val hasOnboarded = prefs.getBoolean("has_onboarded", false)
        if (!hasOnboarded) return

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val storedDate = prefs.getString("today_date", null)

        // Recover the new-day state if date rolled over while app/service was inactive.
        if (storedDate != today) {
            prefs.edit()
                .putString("today_date", today)
                .putInt("today_count", 0)
                .putBoolean("blocking_enabled", true)
                .apply()
        }

        // Always re-arm midnight reset for onboarded users.
        MidnightResetReceiver.scheduleMidnightAlarm(context)

        val blockingEnabled = prefs.getBoolean("blocking_enabled", false)
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
