package com.jskarthik.noscrollscreentimechesspuzzles

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PermissionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "PermissionModule"

  @ReactMethod
  fun checkOverlayPermission(promise: Promise) {
    promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
  }

  @ReactMethod
  fun openOverlaySettings() {
    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:${reactApplicationContext.packageName}")
    )
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactApplicationContext.startActivity(intent)
  }

  @ReactMethod
  fun checkUsageStatsPermission(promise: Promise) {
    val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.unsafeCheckOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      reactApplicationContext.packageName
    )
    promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
  }

  @ReactMethod
  fun openUsageSettings() {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactApplicationContext.startActivity(intent)
  }

  /**
   * Return foreground app usage events since the given timestamp (in ms since epoch).
   * Each event includes packageName and timestamp.
   */
  @ReactMethod
  fun getUsageEvents(sinceMillis: Double, promise: Promise) {
    try {
      val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val startTime = sinceMillis.toLong()
      val endTime = System.currentTimeMillis()

      val events = usageStatsManager.queryEvents(startTime, endTime)
      val resultArray = Arguments.createArray()
      val event = UsageEvents.Event()

      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
          val map = Arguments.createMap()
          map.putString("packageName", event.packageName)
          map.putDouble("timestamp", event.timeStamp.toDouble())
          resultArray.pushMap(map)
        }
      }

      promise.resolve(resultArray)
    } catch (e: Exception) {
      promise.reject("USAGE_EVENTS_ERROR", "Failed to query usage events", e)
    }
  }

  /**
   * Persist the blocked apps configuration as JSON so native code
   * (and future services) can read it without going through JS.
   */
  @ReactMethod
  fun syncBlockedList(blockedAppsJson: String) {
    val prefs = reactApplicationContext.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)
    prefs.edit().putString("blocked_apps", blockedAppsJson).apply()
  }

  /**
   * Sync the user's daily puzzle goal into native prefs so the
   * foreground monitor can stop blocking once the goal is reached.
   */
  @ReactMethod
  fun syncProblemTarget(target: Double) {
    val prefs = reactApplicationContext.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)
    prefs.edit().putInt("problem_target", target.toInt()).apply()
  }

  /**
   * Sync today's solved puzzle count into native prefs. JS passes
   * the ISO date string (yyyy-MM-dd) and the count for that date.
   */
  @ReactMethod
  fun syncTodayPuzzleCount(date: String, count: Double) {
    val prefs = reactApplicationContext.getSharedPreferences("ChessBlockerPrefs", Context.MODE_PRIVATE)
    prefs.edit()
      .putString("today_date", date)
      .putInt("today_count", count.toInt())
      .apply()
  }

  @ReactMethod
  fun startMonitoring() {
    val context = reactApplicationContext
    val intent = Intent(context, ForegroundMonitorService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  @ReactMethod
  fun stopMonitoring() {
    val context = reactApplicationContext
    val intent = Intent(context, ForegroundMonitorService::class.java)
    context.stopService(intent)
  }
}
