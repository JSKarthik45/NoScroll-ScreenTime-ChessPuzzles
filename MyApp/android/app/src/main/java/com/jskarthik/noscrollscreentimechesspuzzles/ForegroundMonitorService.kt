package com.jskarthik.noscrollscreentimechesspuzzles

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import android.content.pm.ServiceInfo
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONObject

class ForegroundMonitorService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var lastEventTime: Long = 0L
  private var isRunning = false

  /**
   * BroadcastReceiver that listens for the "stop blocking" action from the notification.
   * This fulfils the Play Store FGS policy requirement that users can terminate the service.
   */
  private val stopReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
      if (intent?.action == ACTION_STOP_BLOCKING) {
        val prefs = context.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("blocking_enabled", false).apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    // Register the stop-blocking receiver
    val filter = IntentFilter(ACTION_STOP_BLOCKING)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(stopReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(stopReceiver, filter)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!isRunning) {
      isRunning = true
      if (lastEventTime == 0L) {
        lastEventTime = System.currentTimeMillis()
      }
      // Ensure the foreground service is started with the correct type
      // on Android 14+ to avoid runtime crashes in release builds.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(
          NOTIFICATION_ID,
          buildNotification(),
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )
      } else {
        startForeground(NOTIFICATION_ID, buildNotification())
      }
      scheduleNextTick()
    }
    return START_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    isRunning = false
    handler.removeCallbacksAndMessages(null)
    try { unregisterReceiver(stopReceiver) } catch (_: Exception) {}
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun scheduleNextTick() {
    handler.postDelayed({
      if (!isRunning) return@postDelayed
      try {
        pollUsageEvents()
      } catch (_: Exception) {
      }
      scheduleNextTick()
    }, POLL_INTERVAL_MS)
  }

  private fun pollUsageEvents() {
    val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val startTime = lastEventTime
    val endTime = System.currentTimeMillis()

    val events = usageStatsManager.queryEvents(startTime, endTime)
    val event = UsageEvents.Event()

    // Load blocked configuration and progress from SharedPreferences
    val prefs = getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)

    // Check if blocking is currently enabled
    val blockingEnabled = prefs.getBoolean("blocking_enabled", false)
    if (!blockingEnabled) {
      lastEventTime = endTime
      return
    }

    // Daily goal and today's progress
    val target = prefs.getInt("problem_target", 0)
    val storedDate = prefs.getString("today_date", null)
    val storedCount = prefs.getInt("today_count", 0)
    val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    // If the user has already reached or exceeded today's goal, disable blocking for today.
    if (target > 0 && storedDate == today && storedCount >= target) {
      // Disable blocking when daily goal is completed
      prefs.edit().putBoolean("blocking_enabled", false).apply()
      lastEventTime = endTime
      return
    }

    // Blocked apps configuration (logical keys).
    val blockedJson = prefs.getString("blocked_apps", "{}") ?: "{}"
    val blockedPackages = mutableSetOf<String>()
    try {
      val obj = JSONObject(blockedJson)
      val keys = obj.keys()
      while (keys.hasNext()) {
        val key = keys.next()
        if (!obj.optBoolean(key, false)) continue
        // Map logical keys to actual package names
        val pkgs = mapKeyToPackages(key)
        blockedPackages.addAll(pkgs)
      }
    } catch (_: Exception) {
    }

    if (blockedPackages.isEmpty()) {
      lastEventTime = endTime
      return
    }

    var latestTs = lastEventTime

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.timeStamp > latestTs) {
        latestTs = event.timeStamp
      }
      if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
        val pkg = event.packageName ?: continue
        if (blockedPackages.contains(pkg)) {
          // When a blocked app moves to foreground, bring our app to front instead.
          bringAppToFront()
        }
      }
    }

    lastEventTime = latestTs
  }

  private fun bringAppToFront() {
    try {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
      if (launchIntent != null) {
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        startActivity(launchIntent)
      }
    } catch (_: Exception) {
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Screen Time Monitor",
        NotificationManager.IMPORTANCE_LOW
      )
      channel.description = "Monitors app usage to block distractions."
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    // PendingIntent to open the app when notification is tapped
    val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
    val openPendingIntent = if (openAppIntent != null) {
      PendingIntent.getActivity(
        this, 0, openAppIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else null

    // PendingIntent to stop blocking from the notification action
    val stopIntent = Intent(ACTION_STOP_BLOCKING).setPackage(packageName)
    val stopPendingIntent = PendingIntent.getBroadcast(
      this, 0, stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Blocking distractions is active")
      .setContentText("Monitoring app usage to show chess puzzles.")
      .setStyle(
        NotificationCompat.BigTextStyle()
          .bigText("Monitoring app usage to show chess puzzles. Tap \"Pause Blocking\" to stop.")
      )
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(
        android.R.drawable.ic_menu_close_clear_cancel,
        "Pause Blocking",
        stopPendingIntent
      )

    if (openPendingIntent != null) {
      builder.setContentIntent(openPendingIntent)
    }

    return builder.build()
  }

  private fun mapKeyToPackages(key: String): List<String> {
    return when (key) {
      "facebook" -> listOf("com.facebook.katana", "com.facebook.lite")
      "twitter" -> listOf("com.twitter.android", "com.twitter.android.lite")
      "instagram" -> listOf("com.instagram.android")
      "youtube" -> listOf("com.google.android.youtube")
      "reddit" -> listOf("com.reddit.frontpage")
      "whatsapp" -> listOf("com.whatsapp")
      "snapchat" -> listOf("com.snapchat.android")
      else -> listOf(key)
    }
  }

  companion object {
    private const val CHANNEL_ID = "screen_time_monitor_channel"
    private const val NOTIFICATION_ID = 1001
    private const val POLL_INTERVAL_MS = 1000L
    const val ACTION_STOP_BLOCKING = "com.jskarthik.noscrollscreentimechesspuzzles.ACTION_STOP_BLOCKING"
  }
}
