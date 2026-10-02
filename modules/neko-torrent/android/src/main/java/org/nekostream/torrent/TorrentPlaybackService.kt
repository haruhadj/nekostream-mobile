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
      .setContentText("Streaming a video from peers")
      .setContentIntent(launch)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_NOT_STICKY
  }

  companion object {
    private const val NOTIFICATION_ID = 2207

    fun start(context: Context) {
      val intent = Intent(context, TorrentPlaybackService::class.java)
      context.startForegroundService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, TorrentPlaybackService::class.java))
    }
  }
}
