package org.nekostream.torrent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

internal class TorrentPlaybackService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val channelId = "torrent_playback"
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(channelId, "Torrent playback", NotificationManager.IMPORTANCE_LOW),
    )

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val launch = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val notification = Notification.Builder(this, channelId)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("NekoStream torrent player")
      .setContentText(intent?.getStringExtra(EXTRA_STATUS) ?: STATUS_LOOKING_UP)
      .setContentIntent(launch)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    Log.i(TAG, "Foreground torrent notification active")
    return START_NOT_STICKY
  }

  companion object {
    private const val NOTIFICATION_ID = 2207
    private const val EXTRA_STATUS = "status"
    private const val STATUS_LOOKING_UP = "Finding torrent metadata and peers"
    private const val TAG = "NekoTorrent"

    fun start(context: Context, status: String = STATUS_LOOKING_UP) {
      val intent = Intent(context, TorrentPlaybackService::class.java)
        .putExtra(EXTRA_STATUS, status)
      try {
        context.startForegroundService(intent)
      } catch (error: Throwable) {
        Log.e(TAG, "Could not start foreground torrent service", error)
        throw error
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, TorrentPlaybackService::class.java))
    }
  }
}
