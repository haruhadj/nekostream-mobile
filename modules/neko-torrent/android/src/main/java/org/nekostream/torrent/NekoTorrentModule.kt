package org.nekostream.torrent

import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NekoTorrentModule : Module() {
  private var engine: TorrentEngine? = null

  override fun definition() = ModuleDefinition {
    Name("NekoTorrent")

    AsyncFunction("prepareAsync") { magnetUri: String ->
      check(Build.VERSION.SDK_INT >= 28) { "Torrent playback requires Android 9 or newer." }
      val context = requireNotNull(appContext.reactContext)
      engine?.stop()
      engine = TorrentEngine(context)
      try {
        TorrentPlaybackService.start(context)
        engine!!.prepare(magnetUri)
      } catch (error: Throwable) {
        Log.e(TAG, "prepareAsync failed", error)
        runCatching { engine?.stop() }
          .onFailure { cleanupError -> Log.w(TAG, "Torrent cleanup failed after prepareAsync error", cleanupError) }
        engine = null
        runCatching { TorrentPlaybackService.stop(context) }
          .onFailure { cleanupError -> Log.w(TAG, "Could not stop torrent notification after prepareAsync error", cleanupError) }
        throw error
      }
    }

    AsyncFunction("playAsync") { fileIndex: Int ->
      try {
        val streamUrl = requireNotNull(engine) { "Open a torrent before choosing a video." }.play(fileIndex)
        TorrentPlaybackService.start(
          requireNotNull(appContext.reactContext),
          "Streaming a video from peers",
        )
        streamUrl
      } catch (error: Throwable) {
        Log.e(TAG, "playAsync failed", error)
        throw error
      }
    }

    AsyncFunction("statusAsync") {
      engine?.status() ?: mapOf("state" to "idle")
    }

    AsyncFunction("stopAsync") {
      engine?.stop()
      engine = null
      appContext.reactContext?.let(TorrentPlaybackService::stop)
    }

    OnDestroy {
      engine?.stop()
      engine = null
      appContext.reactContext?.let(TorrentPlaybackService::stop)
    }
  }

  private companion object {
    const val TAG = "NekoTorrent"
  }
}
