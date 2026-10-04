package org.nekostream.torrent

import android.content.Context
import android.util.Log
import org.libtorrent4j.AddTorrentParams
import org.libtorrent4j.Priority
import org.libtorrent4j.SessionManager
import org.libtorrent4j.SettingsPack
import org.libtorrent4j.swig.settings_pack
import org.libtorrent4j.TorrentHandle
import org.libtorrent4j.TorrentFlags
import org.libtorrent4j.TorrentInfo
import java.io.File
import java.util.UUID

internal class TorrentEngine(private val context: Context, private val preferences: TorrentPreferences) {
  private val directory = File(context.cacheDir, "torrent-streams/${UUID.randomUUID()}")
  private var manager: SessionManager? = null
  private var info: TorrentInfo? = null
  private var downloadParams: AddTorrentParams? = null
  private var handle: TorrentHandle? = null
  private var server: LoopbackStreamServer? = null
  private var selectedFileIndex: Int? = null

  fun prepare(magnetUri: String): Map<String, Any> {
    require(magnetUri.startsWith("magnet:?xt=urn:btih:")) { "This release has no usable magnet link." }
    check(directory.mkdirs()) { "Could not create the stream cache." }

    Log.i(TAG, "Starting libtorrent session")
    val session = SessionManager()
    session.start()
    // Keep seeds connected so selecting another file does not wait for a peer retry.
    session.applySettings(
      SettingsPack()
        .setBoolean(settings_pack.bool_types.close_redundant_connections.swigValue(), false)
        .setBoolean(settings_pack.bool_types.enable_dht.swigValue(), preferences.enableDht)
        .setBoolean(settings_pack.bool_types.enable_lsd.swigValue(), preferences.enableLocalDiscovery)
        .setInteger(settings_pack.int_types.connections_limit.swigValue(), preferences.maxConnections)
        .downloadRateLimit(preferences.downloadLimitKiB * 1024)
        .uploadRateLimit(preferences.uploadLimitKiB * 1024),
    )
    manager = session

    Log.i(TAG, "Session started; requesting torrent metadata")
    val metadata = session.fetchMagnet(magnetUri, preferences.metadataTimeout, directory)
      ?: throw IllegalStateException("Could not find torrent metadata. Check seeders and try again.")
    val torrent = TorrentInfo(metadata)
    check(torrent.isValid) { "The torrent metadata is invalid." }
    info = torrent
    // In libtorrent 2.1, tracker and peer details live outside TorrentInfo.
    downloadParams = AddTorrentParams.parseMagnetUri(magnetUri).apply {
      setTorrentInfo(torrent)
      setSavePath(directory.absolutePath)
      if (!torrent.isPrivate) setTrackers((getTrackers() + preferences.trackers).distinct())
    }

    val files = torrent.files()
    val videos = (0 until files.numFiles())
      .filter { index -> isVideo(files.fileName(index)) && files.fileSize(index) > 0 }
      .map { index ->
        mapOf(
          "index" to index,
          "name" to files.filePath(index),
          "size" to files.fileSize(index),
        )
      }
    check(videos.isNotEmpty()) { "This torrent contains no supported video file." }
    Log.i(TAG, "Torrent metadata loaded; found ${videos.size} video file(s)")
    return mapOf("name" to torrent.name(), "files" to videos)
  }

  fun play(fileIndex: Int): String {
    val torrent = requireNotNull(info) { "Torrent metadata is not ready." }
    val session = requireNotNull(manager)
    val files = torrent.files()
    require(fileIndex in 0 until files.numFiles() && isVideo(files.fileName(fileIndex))) {
      "Choose a video file from this torrent."
    }

    server?.close()
    server = null
    val priorities = Array(files.numFiles()) { Priority.IGNORE }
    // Keep the whole episode at normal priority; the stream server boosts its current piece window.
    priorities[fileIndex] = Priority.DEFAULT
    val torrentHandle = handle ?: run {
      val params = requireNotNull(downloadParams) { "Torrent metadata is not ready." }
      params.filePriorities(priorities)
      params.setFlags(
        params.getFlags().and_(TorrentFlags.PAUSED.or_(TorrentFlags.AUTO_MANAGED).inv()),
      )
      session.swig().async_add_torrent(params.swig())
      waitForHandle(session, torrent).also { handle = it }
    }
    torrentHandle.clearPieceDeadlines()
    torrentHandle.prioritizeFiles(priorities)
    torrentHandle.resume()
    selectedFileIndex = fileIndex

    val videoFile = File(directory, files.filePath(fileIndex)).canonicalFile
    check(videoFile.path.startsWith(directory.canonicalPath + File.separator)) {
      "The torrent contains an unsafe file path."
    }
    val fileEnd = files.fileOffset(fileIndex) + files.fileSize(fileIndex)
    val endPieceExclusive = ((fileEnd - 1) / torrent.pieceLength() + 1).toInt()
    val stream = LoopbackStreamServer(
      torrentHandle,
      videoFile,
      files.fileOffset(fileIndex),
      files.fileSize(fileIndex),
      torrent.pieceLength(),
      minOf(torrent.numPieces(), endPieceExclusive),
      preferences.serverPort,
    )
    server = stream
    return stream.start()
  }

  fun status(): Map<String, Any> {
    val torrentHandle = handle ?: return mapOf("state" to if (info == null) "metadata" else "ready")
    val snapshot = torrentHandle.status()
    val index = selectedFileIndex
    val torrent = info
    val downloaded = if (index != null && torrent != null) {
      torrentHandle.fileProgress().getOrNull(index) ?: 0L
    } else 0L
    return mapOf(
      "state" to if (snapshot.errorCode().isError) "error" else "downloading",
      "downloadedBytes" to downloaded,
      "totalBytes" to (index?.let { torrent?.files()?.fileSize(it) } ?: 0L),
      "downloadRate" to snapshot.downloadRate(),
      "peers" to snapshot.numPeers(),
      "error" to snapshot.errorCode().getMessage(),
    )
  }

  fun ownsCache(file: File): Boolean = file.canonicalFile == directory.canonicalFile

  fun stop() {
    server?.close()
    server = null
    handle = null
    info = null
    downloadParams = null
    selectedFileIndex = null
    manager?.stop()
    manager = null
    directory.deleteRecursively()
  }

  private fun waitForHandle(session: SessionManager, torrent: TorrentInfo): TorrentHandle {
    repeat(100) {
      val found = session.find(torrent.infoHash())
      if (found != null && found.isValid) return found
      Thread.sleep(100)
    }
    throw IllegalStateException("The torrent could not start downloading.")
  }

  private fun isVideo(name: String): Boolean =
    listOf(".mp4", ".m4v", ".mkv", ".webm", ".mov", ".ts")
      .any { extension -> name.endsWith(extension, ignoreCase = true) }

  private companion object {
    const val TAG = "NekoTorrent"
  }
}
