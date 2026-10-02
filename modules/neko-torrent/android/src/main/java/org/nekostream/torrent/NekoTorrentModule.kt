package org.nekostream.torrent

import android.os.Build
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
        engine!!.prepare(magnetUri)
      } catch (error: Throwable) {
        engine?.stop()
        engine = null
        throw error
      }
    }

    AsyncFunction("playAsync") { fileIndex: Int ->
      val streamUrl = requireNotNull(engine) { "Open a torrent before choosing a video." }.play(fileIndex)
      TorrentPlaybackService.start(requireNotNull(appContext.reactContext))
      streamUrl
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
}
