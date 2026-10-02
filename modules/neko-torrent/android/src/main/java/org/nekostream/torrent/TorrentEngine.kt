package org.nekostream.torrent

import android.content.Context
import android.util.Log
import org.libtorrent4j.Priority
import org.libtorrent4j.SessionManager
import org.libtorrent4j.TorrentHandle
import org.libtorrent4j.TorrentInfo
import java.io.File
import java.util.UUID

internal class TorrentEngine(private val context: Context) {
  private val directory = File(context.cacheDir, "torrent-streams/${UUID.randomUUID()}")
  private var manager: SessionManager? = null
  private var info: TorrentInfo? = null
  private var handle: TorrentHandle? = null
  private var server: LoopbackStreamServer? = null
  private var selectedFileIndex: Int? = null

  fun prepare(magnetUri: String): Map<String, Any> {
    require(magnetUri.startsWith("magnet:?xt=urn:btih:")) { "This release has no usable magnet link." }
    check(directory.mkdirs()) { "Could not create the stream cache." }

    Log.i(TAG, "Starting libtorrent session")
    val session = SessionManager()
    session.start()
    manager = session

    Log.i(TAG, "Session started; requesting torrent metadata")
    val metadata = session.fetchMagnet(magnetUri, 60, directory)
      ?: throw IllegalStateException("Could not find torrent metadata. Check seeders and try again.")
    val torrent = TorrentInfo(metadata)
    check(torrent.isValid) { "The torrent metadata is invalid." }
    info = torrent

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
    val torrentHandle = handle ?: run {
      session.download(torrent, directory)
      waitForHandle(session, torrent).also { handle = it }
    }
    val priorities = Array(files.numFiles()) { Priority.IGNORE }
    // Keep the whole episode at normal priority; the stream server boosts its current piece window.
    priorities[fileIndex] = Priority.DEFAULT
    torrentHandle.prioritizeFiles(priorities)
    selectedFileIndex = fileIndex

    val videoFile = File(directory, files.filePath(fileIndex)).canonicalFile
    check(videoFile.path.startsWith(directory.canonicalPath + File.separator)) {
      "The torrent contains an unsafe file path."
    }
    val stream = LoopbackStreamServer(
      torrentHandle,
      videoFile,
      files.fileOffset(fileIndex),
      files.fileSize(fileIndex),
      torrent.pieceLength(),
      torrent.numPieces(),
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

  fun stop() {
    server?.close()
    server = null
    handle = null
    info = null
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
