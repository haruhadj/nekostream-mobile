package org.nekostream.torrent

import java.io.File
import java.nio.file.Files
import java.nio.file.LinkOption
import java.util.Comparator
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NekoTorrentModule : Module() {
  private var engine: TorrentEngine? = null

  override fun definition() = ModuleDefinition {
    Name("NekoTorrent")

    AsyncFunction("prepareAsync") { magnetUri: String, options: Map<String, Any> ->
      check(Build.VERSION.SDK_INT >= 28) { "Torrent playback requires Android 9 or newer." }
      val context = requireNotNull(appContext.reactContext)
      val preferences = TorrentPreferences.from(options)
      engine?.stop()
      engine = TorrentEngine(context, preferences)
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

    AsyncFunction("clearCacheAsync") {
      val context = requireNotNull(appContext.reactContext)
      val root = File(context.cacheDir, "torrent-streams")
      var removed = 0L
      root.listFiles()?.filter { engine?.ownsCache(it) != true }?.forEach { file ->
        removed += removeCachedPath(file)
      }
      removed
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

private fun removeCachedPath(file: File): Long {
  var removed = 0L
  // Files.walk does not follow symbolic links outside the cache.
  Files.walk(file.toPath()).use { paths ->
    paths.sorted(Comparator.reverseOrder()).forEach { path ->
      val bytes = if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) Files.size(path) else 0L
      Files.delete(path)
      removed += bytes
    }
  }
  return removed
}
