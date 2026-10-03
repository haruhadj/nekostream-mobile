import Feather from "@expo/vector-icons/Feather";
import { useEvent } from "expo";
import { Stack, useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useVideoPlayer, VideoView, type AudioTrack, type SubtitleTrack, type VideoContentFit, type VideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
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
import { SCREEN_PADDING } from "@/ui/screen";

export default function TorrentPlayerScreen() {
  const { magnet, title } = useLocalSearchParams<{ magnet: string; title: string }>();
  return <TorrentPlayerContent key={magnet} magnet={magnet} title={title} />;
}

function TorrentPlayerContent({ magnet, title }: { magnet?: string; title?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const magnetUri = magnet ? decodeTorrentMagnet(magnet) : null;
  const player = useVideoPlayer(null);
  const { status: videoStatus, error: videoError } = useEvent(
    player,
    "statusChange",
    { status: player.status, error: undefined },
  );
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const timeUpdate = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const sourceLoad = useEvent(player, "sourceLoad", null);
  const { availableSubtitleTracks } = useEvent(player, "availableSubtitleTracksChange", {
    availableSubtitleTracks: player.availableSubtitleTracks,
  });
  const { subtitleTrack } = useEvent(player, "subtitleTrackChange", {
    subtitleTrack: player.subtitleTrack,
  });
  const playbackRateChange = useEvent(player, "playbackRateChange", { playbackRate: player.playbackRate });
  const run = useRef(0);
  const streamUri = useRef<string | null>(null);
  const subtitleChoiceMade = useRef(false);
  const [metadata, setMetadata] = useState<TorrentMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState<TorrentVideo | null>(null);
  const [phase, setPhase] = useState<"metadata" | "select" | "starting" | "playing">("metadata");
  const [torrentStatus, setTorrentStatus] = useState<TorrentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsLocked, setControlsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panel, setPanel] = useState<"audio" | "subtitles" | "speed" | "files" | null>(null);
  const [contentFit, setContentFit] = useState<VideoContentFit>("contain");
  const [scrubWidth, setScrubWidth] = useState(0);
  const currentTime = timeUpdate?.currentTime ?? 0;
  const duration = sourceLoad?.duration ?? player.duration;
  const bufferedTime = player.bufferedPosition;
  const playedPercent = duration > 0 ? Math.min(currentTime / duration, 1) * 100 : 0;
  const bufferedPercent = duration > 0 && bufferedTime >= 0
    ? Math.min(bufferedTime / duration, 1) * 100
    : 0;
  const audioTracks = sourceLoad?.availableAudioTracks ?? player.availableAudioTracks;
  const subtitleTracks = availableSubtitleTracks;
  const availabilityError = !NekoTorrent
    ? "Torrent playback is available in the rebuilt Android app."
    : !magnetUri ? "This release has no magnet link." : null;

  const playFile = useCallback(async (file: TorrentVideo, currentRun: number) => {
    if (!NekoTorrent) return;
    subtitleChoiceMade.current = false;
    streamUri.current = null;
    setSelectedFile(file);
    setPhase("starting");
    setError(null);
    try {
      const uri = await NekoTorrent.playAsync(file.index);
      if (run.current !== currentRun) return;
      streamUri.current = uri;
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

  useEffect(() => {
    setTimeUpdateInterval(player, 0.5);
  }, [player]);

  useEffect(() => {
    if (subtitleChoiceMade.current || !sourceLoad) return;
    const loadedSource = sourceLoad.videoSource;
    if (!loadedSource || typeof loadedSource !== "object" || loadedSource.uri !== streamUri.current) return;

    const tracks = player.availableSubtitleTracks;
    if (!tracks.length) return;
    setSubtitleTrack(player, tracks.find((track) => track.isDefault) ?? tracks[0]);
    subtitleChoiceMade.current = true;
  }, [availableSubtitleTracks, player, sourceLoad]);

  useEffect(() => {
    if (!isFullscreen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setIsFullscreen(false);
      return true;
    });
    return () => subscription.remove();
  }, [isFullscreen]);

  useEffect(() => {
    if (!isPlaying || !controlsVisible || panel || controlsLocked) return;
    const timer = setTimeout(() => setControlsVisible(false), 4_000);
    return () => clearTimeout(timer);
  }, [controlsLocked, controlsVisible, isPlaying, panel]);

  const seekTo = useCallback((seconds: number) => {
    const boundedTime = Math.max(0, Math.min(seconds, duration || seconds));
    seekPlayer(player, boundedTime);
  }, [duration, player]);

  const seekFromScrub = useCallback((event: GestureResponderEvent) => {
    if (duration <= 0 || scrubWidth <= 0) return;
    seekTo((event.nativeEvent.locationX / scrubWidth) * duration);
  }, [duration, scrubWidth, seekTo]);

  const showControls = () => {
    if (controlsLocked) return;
    setControlsVisible((visible) => !visible);
  };

  const selectAudioTrack = (track: AudioTrack | null) => {
    setAudioTrack(player, track);
    setPanel(null);
  };

  const selectSubtitleTrack = (track: SubtitleTrack | null) => {
    subtitleChoiceMade.current = true;
    setSubtitleTrack(player, track);
    setPanel(null);
  };

  const toggleContentFit = () => {
    setContentFit((current) => current === "contain" ? "cover" : current === "cover" ? "fill" : "contain");
  };

  const toggleFullscreen = () => {
    setPanel(null);
    setControlsVisible(true);
    setIsFullscreen((current) => !current);
  };

  return (
    <View style={[styles.screen, !isFullscreen && { paddingTop: insets.top }]}>
      <Stack.Screen options={{
        headerShown: false,
        orientation: isFullscreen ? "landscape" : "portrait",
        statusBarHidden: isFullscreen,
        navigationBarHidden: isFullscreen,
      }} />
      <View style={isFullscreen ? styles.fullscreenFrame : styles.videoFrame}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit={contentFit}
          surfaceType="textureView"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={showControls} accessibilityLabel="Show player controls" />
        {controlsVisible ? (
          <View style={[styles.controls, isFullscreen && {
            paddingLeft: Math.max(insets.left, 10),
            paddingRight: Math.max(insets.right, 10),
            paddingTop: Math.max(insets.top, 5),
            paddingBottom: Math.max(insets.bottom, 5),
          }]} pointerEvents="box-none">
            <View style={styles.topControls} pointerEvents="box-none">
              <ControlButton
                icon="arrow-left"
                label={isFullscreen ? "Exit fullscreen" : "Back"}
                onPress={() => isFullscreen ? toggleFullscreen() : router.back()}
              />
              <View style={styles.videoHeading} pointerEvents="none">
                <Text style={styles.videoTitle} numberOfLines={1}>{title ?? selectedFile?.name ?? metadata?.name ?? "Torrent player"}</Text>
                {selectedFile ? <Text style={styles.videoSubtitle} numberOfLines={1}>{selectedFile.name}</Text> : null}
              </View>
              <ControlButton icon="list" label="Video list" onPress={() => setPanel("files")} />
              <ControlButton icon="more-vertical" label="More player settings" onPress={() => setPanel(panel ? null : "speed")} />
            </View>

            {!controlsLocked ? (
              <View style={styles.middleControls} pointerEvents="box-none">
                <ControlButton icon="rotate-ccw" label="Back 10 seconds" onPress={() => seekTo(currentTime - 10)} size={26} />
                <ControlButton
                  icon={isPlaying ? "pause" : "play"}
                  label={isPlaying ? "Pause" : "Play"}
                  onPress={() => isPlaying ? player.pause() : player.play()}
                  size={34}
                  prominent
                />
                <ControlButton icon="rotate-cw" label="Forward 10 seconds" onPress={() => seekTo(currentTime + 10)} size={26} />
              </View>
            ) : (
              <View style={styles.middleControls} pointerEvents="box-none">
                <ControlButton icon="unlock" label="Unlock player controls" onPress={() => setControlsLocked(false)} size={26} prominent />
              </View>
            )}

            {!controlsLocked ? (
              <View style={styles.bottomControls}>
                <View style={styles.actionRow}>
                  <ControlButton icon="lock" label="Lock player controls" onPress={() => setControlsLocked(true)} />
                  <ControlButton icon="maximize" label={`Video size: ${contentFit}`} onPress={toggleContentFit} />
                  <Pressable style={styles.speedButton} onPress={() => setPanel("speed")} accessibilityLabel="Playback speed">
                    <Text style={styles.speedText}>{playbackRateChange.playbackRate.toFixed(2)}x</Text>
                  </Pressable>
                  <ControlButton icon="volume-2" label="Audio tracks" onPress={() => setPanel("audio")} />
                  <ControlButton icon="list" label="Subtitles" onPress={() => setPanel("subtitles")} />
                  <ControlButton icon={isFullscreen ? "minimize-2" : "maximize-2"} label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onPress={toggleFullscreen} />
                </View>
                <View style={styles.scrubRow}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Pressable
                    style={styles.scrubTrack}
                    onLayout={(event) => setScrubWidth(event.nativeEvent.layout.width)}
                    onPress={(event) => seekFromScrub(event)}
                    accessibilityRole="adjustable"
                    accessibilityLabel="Seek video"
                  >
                    <View style={styles.scrubBackground} />
                    <View style={[styles.scrubBuffered, { width: `${bufferedPercent}%` }]} />
                    <View style={[styles.scrubProgress, { width: `${playedPercent}%` }]} />
                    <View style={[styles.scrubThumb, { left: `${playedPercent}%` }]} />
                  </Pressable>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {panel ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{panelTitle(panel)}</Text>
              <ControlButton icon="x" label="Close" onPress={() => setPanel(null)} />
            </View>
            <ScrollView style={styles.panelOptions}>
              {panel === "speed" ? (
                [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                  <PanelOption key={rate} label={`${rate.toFixed(2)}x`} selected={playbackRateChange.playbackRate === rate} onPress={() => {
                    setPlaybackRate(player, rate);
                    setPanel(null);
                  }} />
                ))
              ) : null}
              {panel === "audio" ? audioTracks.length ? audioTracks.map((track, index) => (
                <PanelOption key={track.id ?? `${track.language}-${index}`} label={track.label || track.language || `Audio ${index + 1}`} selected={player.audioTrack === track} onPress={() => selectAudioTrack(track)} />
              )) : <Text style={styles.panelEmpty}>No alternate audio tracks</Text> : null}
              {panel === "subtitles" ? (
                <>
                  <PanelOption label="Off" selected={subtitleTrack === null} onPress={() => selectSubtitleTrack(null)} />
                  {subtitleTracks.map((track, index) => (
                    <PanelOption
                      key={track.id ?? `${track.language}-${index}`}
                      label={track.name || track.label || track.language || `Subtitle ${index + 1}`}
                      selected={subtitleTrack?.id === track.id && subtitleTrack?.language === track.language}
                      onPress={() => selectSubtitleTrack(track)}
                    />
                  ))}
                  {!subtitleTracks.length ? <Text style={styles.panelEmpty}>No embedded subtitles</Text> : null}
                </>
              ) : null}
              {panel === "files" ? metadata?.files.map((file) => (
                <PanelOption key={file.index} label={file.name} detail={formatBytes(file.size) ?? undefined} selected={selectedFile?.index === file.index} onPress={() => {
                  setPanel(null);
                  void playFile(file, run.current);
                }} />
              )) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {!isFullscreen ? <ScrollView contentContainerStyle={styles.content}>
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
      </ScrollView> : null}
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  size = 18,
  prominent = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  size?: number;
  prominent?: boolean;
}) {
  return (
    <Pressable
      style={[styles.controlButton, prominent && styles.prominentControl]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} color="#fff" size={size} />
    </Pressable>
  );
}

function PanelOption({ label, detail, selected = false, onPress }: { label: string; detail?: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.panelOption} onPress={onPress} accessibilityRole="button">
      <View style={styles.panelOptionText}>
        <Text style={styles.panelOptionLabel} numberOfLines={2}>{label}</Text>
        {detail ? <Text style={styles.panelOptionDetail}>{detail}</Text> : null}
      </View>
      {selected ? <Feather name="check" size={18} color={theme.color.accent} /> : null}
    </Pressable>
  );
}

function panelTitle(panel: "audio" | "subtitles" | "speed" | "files"): string {
  switch (panel) {
    case "audio": return "Audio track";
    case "subtitles": return "Subtitles";
    case "speed": return "Playback speed";
    case "files": return "Video list";
  }
}

function setTimeUpdateInterval(player: VideoPlayer, seconds: number): void {
  player.timeUpdateEventInterval = seconds;
}

function seekPlayer(player: VideoPlayer, seconds: number): void {
  player.currentTime = seconds;
}

function setAudioTrack(player: VideoPlayer, track: AudioTrack | null): void {
  player.audioTrack = track;
}

function setSubtitleTrack(player: VideoPlayer, track: SubtitleTrack | null): void {
  player.subtitleTrack = track;
}

function setPlaybackRate(player: VideoPlayer, rate: number): void {
  player.playbackRate = rate;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  const padded = (value: number) => value.toString().padStart(2, "0");
  return hours > 0
    ? `${padded(hours)}:${padded(minutes)}:${padded(remainder)}`
    : `${padded(minutes)}:${padded(remainder)}`;
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
  screen: { flex: 1, backgroundColor: theme.color.background },
  videoFrame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", overflow: "hidden" },
  fullscreenFrame: { flex: 1, width: "100%", backgroundColor: "#000", overflow: "hidden" },
  controls: { ...StyleSheet.absoluteFill, justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(0,0,0,0.12)" },
  topControls: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.42)", borderRadius: 8 },
  videoHeading: { flex: 1, paddingHorizontal: 5 },
  videoTitle: { ...theme.type.body, color: "#fff", fontWeight: "600" },
  videoSubtitle: { ...theme.type.caption, color: "rgba(255,255,255,0.72)" },
  controlButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  prominentControl: { width: 52, height: 52, backgroundColor: "rgba(0,0,0,0.48)" },
  middleControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22 },
  bottomControls: { gap: 2, backgroundColor: "rgba(0,0,0,0.48)", borderRadius: 8, paddingHorizontal: 4 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  speedButton: { minWidth: 38, height: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  speedText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  scrubRow: { height: 28, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 4 },
  timeText: { color: "#fff", fontSize: 10, fontVariant: ["tabular-nums"] },
  scrubTrack: { height: 18, flex: 1, justifyContent: "center" },
  scrubBackground: { height: 3, backgroundColor: "rgba(255,255,255,0.42)", borderRadius: 3 },
  scrubBuffered: { position: "absolute", left: 0, height: 3, backgroundColor: "rgba(255,255,255,0.78)", borderRadius: 3 },
  scrubProgress: { position: "absolute", left: 0, height: 3, backgroundColor: theme.color.accent, borderRadius: 3 },
  scrubThumb: { position: "absolute", width: 10, height: 10, marginLeft: -5, borderRadius: 5, backgroundColor: "#fff" },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "78%", backgroundColor: "rgba(15,15,17,0.96)", borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 14, paddingBottom: 8 },
  panelHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.18)" },
  panelTitle: { ...theme.type.section, color: "#fff" },
  panelOptions: { flexGrow: 0 },
  panelOption: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.1)" },
  panelOptionText: { flex: 1, gap: 2 },
  panelOptionLabel: { ...theme.type.body, color: "#fff" },
  panelOptionDetail: { ...theme.type.caption, color: "rgba(255,255,255,0.65)" },
  panelEmpty: { ...theme.type.caption, color: "rgba(255,255,255,0.7)", paddingVertical: 16 },
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
