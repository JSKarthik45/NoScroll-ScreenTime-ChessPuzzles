package com.jskarthik.noscrollscreentimechesspuzzles

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * BroadcastReceiver that fires at midnight to reset blocking for the new day.
 * When triggered, it clears the daily puzzle count and re-enables blocking.
 */
class MidnightResetReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = context.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val storedDate = prefs.getString("today_date", null)
        
        // Check if user has completed onboarding (blocking was ever enabled)
        val hasOnboarded = prefs.getBoolean("has_onboarded", false)
        if (!hasOnboarded) {
            // User hasn't completed onboarding, don't enable blocking
            return
        }

        // Avoid duplicate resets if multiple broadcasts/alarms arrive the same day.
        if (storedDate == today) {
            scheduleMidnightAlarm(context)
            return
        }
        
        // Reset today's count and enable blocking for the new day
        prefs.edit()
            .putString("today_date", today)
            .putInt("today_count", 0)
            .putBoolean("blocking_enabled", true)
            .apply()
        
        // Start the foreground monitor service if not already running
        val serviceIntent = Intent(context, ForegroundMonitorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
        
        // Re-schedule for next midnight
        scheduleMidnightAlarm(context)
    }
    
    companion object {
        private const val REQUEST_CODE = 1002
        
        /**
         * Schedule an alarm to fire at the next midnight (00:00:00).
         */
        fun scheduleMidnightAlarm(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, MidnightResetReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            // Calculate next midnight
            val calendar = Calendar.getInstance().apply {
                timeInMillis = System.currentTimeMillis()
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            
            // Prefer exact delivery; gracefully fallback if exact alarms are unavailable.
            try {
                when {
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms() -> {
                        alarmManager.setAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            calendar.timeInMillis,
                            pendingIntent
                        )
                    }
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            calendar.timeInMillis,
                            pendingIntent
                        )
                    }
                    else -> {
                        alarmManager.setExact(
                            AlarmManager.RTC_WAKEUP,
                            calendar.timeInMillis,
                            pendingIntent
                        )
                    }
                }
            } catch (_: SecurityException) {
                // Some OEMs can still reject exact alarms; fallback keeps autonomous daily reset alive.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        calendar.timeInMillis,
                        pendingIntent
                    )
                } else {
                    alarmManager.set(
                        AlarmManager.RTC_WAKEUP,
                        calendar.timeInMillis,
                        pendingIntent
                    )
                }
            }
        }
        
        /**
         * Cancel any pending midnight alarm.
         */
        fun cancelMidnightAlarm(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, MidnightResetReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)
        }
    }
}
