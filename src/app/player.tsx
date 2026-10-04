import { useEvent, useEventListener } from "expo";
import {
  Stack,
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as Notifications from "expo-notifications";
import {
  isPictureInPictureSupported,
  useVideoPlayer,
  VideoView,
  type VideoContentFit,
  type VideoPlayer,
} from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NekoTorrent, {
  type TorrentMetadata,
  type TorrentStatus,
  type TorrentVideo,
} from "../../modules/neko-torrent/src/NekoTorrentModule";

import { formatBytes } from "@shared/format";

import { theme } from "@/theme";
import { decodeTorrentMagnet } from "@/lib/torrent-route";
import { Button } from "@/ui/button";
import { PlayerControls } from "@/components/player/player-controls";
import {
  loadPreferences,
  usePreferences,
  type Preferences,
} from "@/settings/preferences";
import {
  applyPlaybackDefaults,
  applyTrackPreferences,
} from "@/settings/player-defaults";
import {
  getPlaybackPosition,
  playbackPositionKey,
  savePlaybackPosition,
} from "@/settings/playback-position";

function waitForVideoLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export default function TorrentPlayerScreen() {
  const { magnet, title } = useLocalSearchParams<{
    magnet: string;
    title: string;
  }>();
  const { values, ready } = usePreferences();
  if (!ready)
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  return (
    <TorrentPlayerContent
      key={magnet}
      magnet={magnet}
      title={title}
      preferences={values}
    />
  );
}

function TorrentPlayerContent({
  magnet,
  title,
  preferences,
}: {
  magnet?: string;
  title?: string;
  preferences: Preferences;
}) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const magnetUri = magnet ? decodeTorrentMagnet(magnet) : null;
  const player = useVideoPlayer(null);
  const preferencesRef = useRef(preferences);
  const playingFile = useRef<TorrentVideo | null>(null);
  const lastSelectedFileIndex = useRef<number | null>(null);
  const resumeTarget = useRef(0);
  const [sessionPreferences, setSessionPreferences] = useState(preferences);
  const insets = useSafeAreaInsets();
  const fileRequest = useRef(0);
  const videoView = useRef<VideoView>(null);
  const [videoViewRevision, setVideoViewRevision] = useState(0);
  const [pictureInPictureSupported] = useState(() =>
    isPictureInPictureSupported(),
  );
  const { status: videoStatus, error: videoError } = useEvent(
    player,
    "statusChange",
    { status: player.status, error: undefined },
  );
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const run = useRef(0);
  const [metadata, setMetadata] = useState<TorrentMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState<TorrentVideo | null>(null);
  const [phase, setPhase] = useState<
    "metadata" | "select" | "starting" | "playing"
  >("metadata");
  const [torrentStatus, setTorrentStatus] = useState<TorrentStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [landscape, setLandscape] = useState(
    preferences.orientation === "landscape",
  );
  const [autoPlay, setAutoPlay] = useState(preferences.autoPlay);
  const [contentFit, setContentFit] = useState<VideoContentFit>(
    preferences.contentFit,
  );
  const availabilityError = !NekoTorrent
    ? "Torrent playback is available in the rebuilt Android app."
    : !magnetUri
      ? "This release has no magnet link."
      : null;

  const playFile = useCallback(
    async (file: TorrentVideo, currentRun: number) => {
      if (!NekoTorrent) return;
      const request = ++fileRequest.current;
      const previous = playingFile.current;
      if (previous && magnetUri && preferencesRef.current.resumePlayback) {
        void savePlaybackPosition(
          playbackPositionKey(magnetUri, previous.index),
          player.currentTime,
          player.duration,
        ).catch(() => {});
      }
      playingFile.current = null;
      player.pause();
      lastSelectedFileIndex.current = file.index;
      setSelectedFile(file);
      setPhase("starting");
      setError(null);
      setTorrentStatus(null);
      // A fresh texture surface avoids the intermittent Media3/Android
      // first-frame race that can leave audio and subtitles running over a
      // black video after the player is first laid out or reused.
      setVideoViewRevision((revision) => revision + 1);
      try {
        const position =
          preferencesRef.current.resumePlayback && magnetUri
            ? await getPlaybackPosition(
                playbackPositionKey(magnetUri, file.index),
              )
            : 0;
        if (run.current !== currentRun || fileRequest.current !== request)
          return;
        resumeTarget.current = position;
        const uri = await NekoTorrent.playAsync(file.index);
        if (run.current !== currentRun || fileRequest.current !== request)
          return;
        await player.replaceAsync({ uri, contentType: "progressive" });
        if (run.current !== currentRun || fileRequest.current !== request)
          return;
        await waitForVideoLayout();
        if (run.current !== currentRun || fileRequest.current !== request)
          return;
        player.play();
        playingFile.current = file;
        setPhase("playing");
      } catch (cause) {
        if (run.current === currentRun && fileRequest.current === request) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not start playback.",
          );
          setPhase("select");
        }
      }
    },
    [magnetUri, player],
  );

  useFocusEffect(
    useCallback(() => {
      const currentRun = ++run.current;
      const torrent = NekoTorrent;
      if (!torrent || !magnetUri) return;
      void (async () => {
        setPhase("metadata");
        setMetadata(null);
        setSelectedFile(null);
        setError(null);
        setTorrentStatus(null);
        const nextPreferences = await loadPreferences();
        if (run.current !== currentRun) return;
        preferencesRef.current = nextPreferences;
        setSessionPreferences(nextPreferences);
        setLandscape(nextPreferences.orientation === "landscape");
        setContentFit(nextPreferences.contentFit);
        setAutoPlay(nextPreferences.autoPlay);
        applyPlaybackDefaults(player, nextPreferences);
        await prepareTorrentNotifications();
        if (run.current !== currentRun) return;
        const result = await torrent.prepareAsync(magnetUri, nextPreferences);
        if (run.current !== currentRun) return;
        setMetadata(result);
        const previousFile = result.files.find(
          (file) => file.index === lastSelectedFileIndex.current,
        );
        if (previousFile || result.files.length === 1) {
          void playFile(previousFile ?? result.files[0], currentRun);
        } else {
          setPhase("select");
        }
      })().catch((cause) => {
        if (run.current === currentRun) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not open this torrent.",
          );
        }
      });

      return () => {
        run.current = currentRun + 1;
        fileRequest.current += 1;
        try {
          const file = playingFile.current;
          if (file && preferencesRef.current.resumePlayback)
            void savePlaybackPosition(
              playbackPositionKey(magnetUri, file.index),
              player.currentTime,
              player.duration,
            ).catch(() => {});
          playingFile.current = null;
          player.pause();
        } catch {
          /* The player may already be released during Fast Refresh. */
        }
        void torrent.stopAsync().catch(() => {});
      };
    }, [magnetUri, playFile, player]),
  );

  useEffect(() => {
    if (!isFocused || (phase !== "starting" && phase !== "playing")) return;
    const poll = () => {
      void NekoTorrent?.statusAsync()
        .then(setTorrentStatus)
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 1_500);
    return () => clearInterval(timer);
  }, [isFocused, phase]);

  useEffect(() => {
    configureTimeUpdates(player);
  }, [player]);

  useEventListener(player, "sourceLoad", (event) => {
    applyTrackPreferences(
      player,
      preferencesRef.current,
      event.availableAudioTracks,
      event.availableSubtitleTracks,
    );
    if (resumeTarget.current > 0 && event.duration > 0) {
      restorePosition(player, resumeTarget.current, event.duration);
      resumeTarget.current = 0;
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const file = playingFile.current;
      if (file && magnetUri && preferencesRef.current.resumePlayback)
        void savePlaybackPosition(
          playbackPositionKey(magnetUri, file.index),
          player.currentTime,
          player.duration,
        ).catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, [magnetUri, player]);

  useEventListener(player, "playToEnd", () => {
    if (!autoPlay || !isFocused || !metadata || !selectedFile) return;
    const position = metadata.files.findIndex(
      (file) => file.index === selectedFile.index,
    );
    const next = metadata.files[position + 1];
    if (position >= 0 && next) void playFile(next, run.current);
  });

  const playbackError =
    availabilityError ??
    error ??
    (phase === "playing" ? videoError?.message : null) ??
    ((phase === "starting" || phase === "playing") &&
    torrentStatus?.state === "error"
      ? (torrentStatus.error ?? "Playback failed.")
      : null);
  const showStatus = phase !== "playing" || !!playbackError;
  const isBuffering =
    phase === "starting" || (phase === "playing" && videoStatus === "loading");

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: false,
          orientation: landscape ? "landscape" : "portrait",
          statusBarHidden: true,
          navigationBarHidden: true,
          gestureEnabled: false,
        }}
      />
      {isFocused ? <StatusBar hidden /> : null}
      <VideoView
        key={videoViewRevision}
        ref={videoView}
        allowsPictureInPicture={sessionPreferences.pictureInPicture}
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        contentFit={contentFit}
        surfaceType="textureView"
        fullscreenOptions={{ enable: false }}
      />
      <PlayerControls
        key={selectedFile?.index ?? "unselected"}
        player={player}
        preferences={sessionPreferences}
        onOpenPreferences={() => router.push("/playback-settings")}
        supportsPictureInPicture={
          pictureInPictureSupported && sessionPreferences.pictureInPicture
        }
        onPictureInPicture={() => {
          void videoView.current?.startPictureInPicture().catch((cause) => {
            Alert.alert(
              "Picture in picture",
              cause instanceof Error
                ? cause.message
                : "Picture in picture is unavailable.",
            );
          });
        }}
        title={title ?? metadata?.name ?? "Torrent player"}
        metadata={metadata}
        selectedFile={selectedFile}
        contentFit={contentFit}
        isLoading={isBuffering}
        canPlay={phase === "playing" && !playbackError}
        autoPlay={autoPlay}
        onAutoPlayChange={setAutoPlay}
        onBack={() => router.back()}
        onRotate={() => setLandscape((value) => !value)}
        onContentFitChange={() =>
          setContentFit((current) =>
            current === "contain"
              ? "cover"
              : current === "cover"
                ? "fill"
                : "contain",
          )
        }
        onFileSelect={(file) => {
          void playFile(file, run.current);
        }}
      />
      {showStatus ? (
        <View
          style={[
            styles.statusCard,
            {
              marginLeft: Math.max(insets.left, 24),
              marginRight: Math.max(insets.right, 24),
            },
          ]}
        >
          <ScrollView contentContainerStyle={styles.content}>
            {phase === "metadata" && !error && !availabilityError ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.color.accent} />
                <Text style={styles.muted}>
                  Finding torrent metadata and peers…
                </Text>
              </View>
            ) : null}

            {phase === "select" &&
            metadata &&
            !selectedFile &&
            !playbackError ? (
              <View style={styles.fileList}>
                <Text style={styles.heading}>Choose a video</Text>
                {!metadata.files.length ? (
                  <Text style={styles.muted}>
                    This torrent contains no supported video files.
                  </Text>
                ) : null}
                {metadata.files.map((file) => (
                  <Pressable
                    key={file.index}
                    style={styles.file}
                    onPress={() => void playFile(file, run.current)}
                  >
                    <Text style={styles.fileName} numberOfLines={2}>
                      {file.name}
                    </Text>
                    <Text style={styles.muted}>{formatBytes(file.size)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {selectedFile && !playbackError ? (
              <View style={styles.details}>
                <Text style={styles.heading} numberOfLines={2}>
                  {selectedFile.name}
                </Text>
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
                    {formatBytes(torrentStatus.downloadedBytes ?? 0)} /{" "}
                    {formatBytes(torrentStatus.totalBytes ?? 0)}
                    {" · "}
                    {formatBytes(torrentStatus.downloadRate ?? 0)}/s
                    {" · "}
                    {torrentStatus.peers ?? 0} peers
                  </Text>
                ) : null}
              </View>
            ) : null}

            {playbackError ? (
              <View style={styles.errorBox}>
                <Text style={styles.error}>{playbackError}</Text>
                {metadata?.files && selectedFile ? (
                  <Button
                    label="Choose another file"
                    variant="outline"
                    onPress={() => {
                      player.pause();
                      setSelectedFile(null);
                      setPhase("select");
                      setError(null);
                    }}
                  />
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function restorePosition(
  player: VideoPlayer,
  seconds: number,
  duration: number,
) {
  player.currentTime = seconds < duration - 5 ? seconds : 0;
}

function configureTimeUpdates(player: VideoPlayer) {
  player.timeUpdateEventInterval = 0.5;
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
  screen: { flex: 1, backgroundColor: "#000" },
  statusCard: {
    position: "absolute",
    top: "30%",
    bottom: "30%",
    alignSelf: "center",
    width: "85%",
    maxWidth: 640,
    borderRadius: 24,
    backgroundColor: "rgba(25,23,30,0.96)",
  },
  content: { padding: 20, gap: 20 },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  muted: { ...theme.type.caption, color: theme.color.muted },
  heading: { ...theme.type.section, color: "#fff" },
  fileList: { gap: 12 },
  file: {
    padding: 16,
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    gap: 6,
  },
  fileName: { ...theme.type.body, color: "#fff" },
  details: { gap: 8 },
  errorBox: {
    gap: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.color.surface,
  },
  error: { ...theme.type.body, color: theme.color.danger },
});
