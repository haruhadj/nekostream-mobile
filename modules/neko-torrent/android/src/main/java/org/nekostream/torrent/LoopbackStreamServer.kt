package org.nekostream.torrent

import org.libtorrent4j.Priority
import org.libtorrent4j.TorrentHandle
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStream
import java.io.RandomAccessFile
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.Executors

internal class LoopbackStreamServer(
  private val handle: TorrentHandle,
  private val file: File,
  private val fileOffset: Long,
  private val fileSize: Long,
  private val pieceLength: Int,
  private val pieceCount: Int,
) {
  private val token = UUID.randomUUID().toString()
  private val clients = Executors.newCachedThreadPool()
  private lateinit var listener: ServerSocket
  @Volatile private var closed = false

  fun start(): String {
    listener = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
    Thread({ acceptClients() }, "neko-torrent-http").apply { isDaemon = true }.start()
    return "http://127.0.0.1:${listener.localPort}/stream/$token"
  }

  fun close() {
    closed = true
    if (::listener.isInitialized) listener.close()
    clients.shutdownNow()
  }

  private fun acceptClients() {
    while (!closed) {
      try {
        val socket = listener.accept()
        clients.execute { socket.use { serve(it) } }
      } catch (_: Exception) {
        if (!closed) break
      }
    }
  }

  private fun serve(socket: Socket) {
    try {
      socket.soTimeout = 15_000
      val reader = BufferedReader(InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII))
      val request = reader.readLine()?.split(' ') ?: return
      if (request.size < 2 || request[1] != "/stream/$token") {
        respond(socket.getOutputStream(), 404, "Not Found")
        return
      }
      if (request[0] != "GET" && request[0] != "HEAD") {
        respond(socket.getOutputStream(), 405, "Method Not Allowed")
        return
      }

      var rangeHeader: String? = null
      var headerBytes = 0
      while (headerBytes < 8192) {
        val header = reader.readLine() ?: return
        if (header.isEmpty()) break
        headerBytes += header.length
        if (header.startsWith("Range:", ignoreCase = true)) rangeHeader = header.substringAfter(':').trim()
      }
      if (headerBytes >= 8192) {
        respond(socket.getOutputStream(), 431, "Request Header Fields Too Large")
        return
      }

      val range = parseRange(rangeHeader) ?: run {
        respond(socket.getOutputStream(), 416, "Range Not Satisfiable", "Content-Range: bytes */$fileSize\r\n")
        return
      }
      val response = socket.getOutputStream()
      val partial = rangeHeader != null
      val length = range.last - range.first + 1
      val contentRange = if (partial) "Content-Range: bytes ${range.first}-${range.last}/$fileSize\r\n" else ""
      val headers = buildString {
        append("HTTP/1.1 ${if (partial) "206 Partial Content" else "200 OK"}\r\n")
        append("Content-Type: ${contentType()}\r\n")
        append("Content-Length: $length\r\n")
        append("Accept-Ranges: bytes\r\n")
        append(contentRange)
        append("Connection: close\r\n\r\n")
      }
      response.write(headers.toByteArray(StandardCharsets.US_ASCII))
      if (request[0] == "HEAD") return
      writeRange(response, range)
    } catch (_: Exception) {
      // ExoPlayer closes connections during seeks; the next range is served separately.
    }
  }

  private fun writeRange(output: OutputStream, range: LongRange) {
    var position = range.first
    var previousPiece = -1
    var input: RandomAccessFile? = null
    try {
      while (position <= range.last && !closed) {
        val torrentOffset = fileOffset + position
        val piece = (torrentOffset / pieceLength).toInt()
        if (piece != previousPiece) {
          prioritizeWindow(piece)
          waitForPiece(piece)
          previousPiece = piece
        }
        if (input == null) input = RandomAccessFile(file, "r")
        val availableInPiece = pieceLength - (torrentOffset % pieceLength).toInt()
        val count = minOf(256 * 1024L, range.last - position + 1, availableInPiece.toLong()).toInt()
        val bytes = ByteArray(count)
        input.seek(position)
        input.readFully(bytes)
        output.write(bytes)
        position += count
      }
    } finally {
      input?.close()
    }
  }

  private fun prioritizeWindow(firstPiece: Int) {
    for (piece in firstPiece until minOf(firstPiece + 5, pieceCount)) {
      if (handle.havePiece(piece)) continue
      handle.piecePriority(piece, Priority.TOP_PRIORITY)
      handle.setPieceDeadline(piece, (piece - firstPiece) * 250)
    }
  }

  private fun waitForPiece(piece: Int) {
    repeat(300) {
      if (closed) throw IllegalStateException("Stream stopped")
      if (handle.havePiece(piece)) return
      val error = handle.status().errorCode()
      if (error.isError) throw IllegalStateException(error.getMessage())
      Thread.sleep(200)
    }
    throw IllegalStateException("The requested video piece did not download in time.")
  }

  private fun parseRange(header: String?): LongRange? {
    if (header == null) return 0L..(fileSize - 1)
    val match = Regex("^bytes=(\\d*)-(\\d*)$").matchEntire(header) ?: return null
    val startText = match.groupValues[1]
    val endText = match.groupValues[2]
    if (startText.isEmpty() && endText.isEmpty()) return null
    val start = if (startText.isEmpty()) {
      (fileSize - (endText.toLongOrNull() ?: return null)).coerceAtLeast(0)
    } else startText.toLongOrNull() ?: return null
    val end = if (startText.isEmpty() || endText.isEmpty()) fileSize - 1
      else minOf(endText.toLongOrNull() ?: return null, fileSize - 1)
    return if (start < fileSize && end >= start) start..end else null
  }

  private fun contentType(): String = when (file.extension.lowercase()) {
    "mp4", "m4v", "mov" -> "video/mp4"
    "webm" -> "video/webm"
    "ts" -> "video/mp2t"
    else -> "video/x-matroska"
  }

  private fun respond(output: OutputStream, code: Int, reason: String, extra: String = "") {
    output.write("HTTP/1.1 $code $reason\r\n${extra}Content-Length: 0\r\nConnection: close\r\n\r\n".toByteArray(StandardCharsets.US_ASCII))
  }
}
