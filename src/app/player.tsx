import Feather from "@expo/vector-icons/Feather";
import { useEvent } from "expo";
import { Stack, useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import NekoTorrent, {
  type TorrentMetadata,
  type TorrentStatus,
  type TorrentVideo,
} from "../../modules/neko-torrent/src/NekoTorrentModule";

import { formatBytes } from "@shared/format";

import { theme } from "@/theme";
import { decodeTorrentMagnet } from "@/lib/torrent-route";
import { Button } from "@/ui/button";
import { Screen, SCREEN_PADDING } from "@/ui/screen";

export default function TorrentPlayerScreen() {
  const { magnet, title } = useLocalSearchParams<{ magnet: string; title: string }>();
  return <TorrentPlayerContent key={magnet} magnet={magnet} title={title} />;
}

function TorrentPlayerContent({ magnet, title }: { magnet?: string; title?: string }) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const magnetUri = magnet ? decodeTorrentMagnet(magnet) : null;
  const player = useVideoPlayer(null);
  const { status: videoStatus, error: videoError } = useEvent(
    player,
    "statusChange",
    { status: player.status, error: undefined },
  );
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const run = useRef(0);
  const [metadata, setMetadata] = useState<TorrentMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState<TorrentVideo | null>(null);
  const [phase, setPhase] = useState<"metadata" | "select" | "starting" | "playing">("metadata");
  const [torrentStatus, setTorrentStatus] = useState<TorrentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const availabilityError = !NekoTorrent
    ? "Torrent playback is available in the rebuilt Android app."
    : !magnetUri ? "This release has no magnet link." : null;

  const playFile = useCallback(async (file: TorrentVideo, currentRun: number) => {
    if (!NekoTorrent) return;
    setSelectedFile(file);
    setPhase("starting");
    setError(null);
    try {
      const uri = await NekoTorrent.playAsync(file.index);
      if (run.current !== currentRun) return;
      await player.replaceAsync({ uri, contentType: "progressive" });
      if (run.current !== currentRun) return;
      player.play();
      setPhase("playing");
    } catch (cause) {
      if (run.current === currentRun) {
        setError(cause instanceof Error ? cause.message : "Could not start playback.");
        setPhase("select");
      }
    }
  }, [player]);

  useFocusEffect(useCallback(() => {
    const currentRun = ++run.current;
    const torrent = NekoTorrent;
    if (!torrent || !magnetUri) return;
    void (async () => {
      await prepareTorrentNotifications();
      if (run.current !== currentRun) return;
      const result = await torrent.prepareAsync(magnetUri);
      if (run.current !== currentRun) return;
      setMetadata(result);
      if (result.files.length === 1) {
        void playFile(result.files[0], currentRun);
      } else {
        setPhase("select");
      }
    })().catch((cause) => {
      if (run.current === currentRun) {
        setError(cause instanceof Error ? cause.message : "Could not open this torrent.");
      }
    });

    return () => {
      run.current = currentRun + 1;
      try { player.pause(); } catch { /* The player may already be released during Fast Refresh. */ }
      void torrent.stopAsync().catch(() => {});
    };
  }, [magnetUri, playFile, player]));

  useEffect(() => {
    if (!isFocused || (phase !== "starting" && phase !== "playing")) return;
    const poll = () => {
      void NekoTorrent?.statusAsync().then(setTorrentStatus).catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 1_500);
    return () => clearInterval(timer);
  }, [isFocused, phase]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
          <Feather name="arrow-left" color={theme.color.foreground} size={22} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title ?? metadata?.name ?? "Torrent player"}</Text>
      </View>

      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        fullscreenOptions={{ enable: true }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {phase === "metadata" && !error && !availabilityError ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.color.accent} />
            <Text style={styles.muted}>Finding torrent metadata and peers…</Text>
          </View>
        ) : null}

        {phase === "select" && metadata && !selectedFile ? (
          <View style={styles.fileList}>
            <Text style={styles.heading}>Choose a video</Text>
            {metadata.files.map((file) => (
              <Pressable key={file.index} style={styles.file} onPress={() => void playFile(file, run.current)}>
                <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
                <Text style={styles.muted}>{formatBytes(file.size)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {selectedFile ? (
          <View style={styles.details}>
            <Text style={styles.heading} numberOfLines={2}>{selectedFile.name}</Text>
            <Text style={styles.muted}>
              {phase === "starting"
                ? "Starting stream…"
                : isPlaying
                  ? "Playing from peers"
                  : videoStatus === "readyToPlay"
                    ? "Ready to play"
                    : "Buffering from peers…"}
            </Text>
            {torrentStatus?.state === "downloading" ? (
              <Text style={styles.muted}>
                {formatBytes(torrentStatus.downloadedBytes ?? 0)} / {formatBytes(torrentStatus.totalBytes ?? 0)}
                {" · "}{formatBytes(torrentStatus.downloadRate ?? 0)}/s
                {" · "}{torrentStatus.peers ?? 0} peers
              </Text>
            ) : null}
          </View>
        ) : null}

        {availabilityError || error || videoError || torrentStatus?.state === "error" ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>
              {availabilityError ?? error ?? videoError?.message ?? torrentStatus?.error ?? "Playback failed."}
            </Text>
            {metadata?.files && selectedFile ? (
              <Button label="Choose another file" variant="outline" onPress={() => {
                player.pause();
                setSelectedFile(null);
                setPhase("select");
                setError(null);
              }} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

async function prepareTorrentNotifications(): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    await Notifications.setNotificationChannelAsync("torrent_playback", {
      name: "Torrent playback",
      importance: Notifications.AndroidImportance.LOW,
    });
    const currentPermission = await Notifications.getPermissionsAsync();
    if (!currentPermission.granted && currentPermission.canAskAgain) {
      await Notifications.requestPermissionsAsync();
    }
  } catch (cause) {
    console.warn("Could not prepare torrent playback notifications", cause);
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: SCREEN_PADDING, height: 56 },
  back: { width: 36, height: 44, justifyContent: "center" },
  title: { ...theme.type.section, color: theme.color.foreground, flex: 1 },
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  content: { padding: SCREEN_PADDING, gap: 20 },
  loading: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  muted: { ...theme.type.caption, color: theme.color.muted },
  heading: { ...theme.type.section, color: theme.color.foreground },
  fileList: { gap: 12 },
  file: { padding: 16, backgroundColor: theme.color.surface, borderRadius: 12, gap: 6 },
  fileName: { ...theme.type.body, color: theme.color.foreground },
  details: { gap: 8 },
  errorBox: { gap: 16, padding: 16, borderRadius: 12, backgroundColor: theme.color.surface },
  error: { ...theme.type.body, color: theme.color.danger },
});
