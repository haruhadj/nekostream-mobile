package org.nekostream.torrent

import java.net.URI

internal data class TorrentPreferences(
  val serverPort: Int,
  val trackers: List<String>,
  val enableDht: Boolean,
  val enableLocalDiscovery: Boolean,
  val maxConnections: Int,
  val downloadLimitKiB: Int,
  val uploadLimitKiB: Int,
  val metadataTimeout: Int,
) {
  companion object {
    fun from(options: Map<String, Any>): TorrentPreferences {
      fun integer(key: String, fallback: Int, range: IntRange): Int {
        val value = (options[key] as? Number)?.toInt() ?: fallback
        require(value in range) { "Invalid torrent setting: $key" }
        return value
      }
      val port = integer("serverPort", 0, 0..65535)
      require(port == 0 || port >= 1024) { "The stream port must be 0 or between 1024 and 65535." }
      val trackers = (options["trackers"] as? String).orEmpty().split(Regex("\\s+"))
        .filter { it.isNotBlank() }.distinct()
      require(trackers.size <= 40) { "Use at most 40 trackers." }
      trackers.forEach { tracker ->
        val uri = URI(tracker)
        val scheme = uri.scheme?.lowercase()
        require(
          scheme in listOf("http", "https", "udp") && uri.host != null &&
            uri.userInfo == null && uri.fragment == null &&
            (scheme != "udp" || uri.port in 1..65535),
        ) {
          "Invalid tracker URL: $tracker"
        }
      }
      return TorrentPreferences(
        port, trackers,
        options["enableDht"] as? Boolean ?: true,
        options["enableLocalDiscovery"] as? Boolean ?: true,
        integer("maxConnections", 80, 10..200),
        integer("downloadLimitKiB", 0, 0..100000),
        integer("uploadLimitKiB", 0, 0..100000),
        integer("metadataTimeout", 60, 15..180),
      )
    }
  }
}
