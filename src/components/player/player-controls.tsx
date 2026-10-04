import { useEvent } from "expo";
import { LinearGradient } from "expo-linear-gradient";
import type { VideoContentFit, VideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  TorrentMetadata,
  TorrentVideo,
} from "../../../modules/neko-torrent/src/NekoTorrentModule";
import { theme } from "@/theme";
import type { Preferences } from "@/settings/preferences";

import { ControlButton } from "./control-button";
import { PlayerOptionsSheet, type PlayerPanel } from "./player-options-sheet";

type Panel = PlayerPanel | null;

type PlayerControlsProps = {
  player: VideoPlayer;
  preferences: Preferences;
  onOpenPreferences: () => void;
  title: string;
  metadata: TorrentMetadata | null;
  selectedFile: TorrentVideo | null;
  contentFit: VideoContentFit;
  isLoading: boolean;
  canPlay: boolean;
  autoPlay: boolean;
  onAutoPlayChange: (enabled: boolean) => void;
  onBack: () => void;
  onRotate: () => void;
  onContentFitChange: () => void;
  onFileSelect: (file: TorrentVideo) => void;
  onPictureInPicture: () => void;
  supportsPictureInPicture: boolean;
};

export function PlayerControls({
  player,
  preferences,
  onOpenPreferences,
  title,
  metadata,
  selectedFile,
  contentFit,
  isLoading,
  canPlay,
  autoPlay,
  onAutoPlayChange,
  onBack,
  onRotate,
  onContentFitChange,
  onFileSelect,
  onPictureInPicture,
  supportsPictureInPicture,
}: PlayerControlsProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 600;
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [interaction, setInteraction] = useState(0);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(preferences.showRemainingTime);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scrubWidth = useRef(0);
  const scrubTarget = useRef<number | null>(null);
  const lastTap = useRef({ time: 0, zone: -1 });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureStart = useRef({ x: 0, y: 0, time: 0, volume: 1 });
  const gestureMode = useRef<"seek" | "volume" | "disabled" | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const time = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const source = useEvent(player, "sourceLoad", null);
  const { playbackRate } = useEvent(player, "playbackRateChange", {
    playbackRate: player.playbackRate,
  });
  const duration = source?.duration ?? player.duration;
  const currentTime = scrubTime ?? time.currentTime;
  const files = metadata?.files ?? [];
  const filePosition = files.findIndex(
    (file) => file.index === selectedFile?.index,
  );
  const progress = percentage(currentTime, duration);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: preferences.reduceMotion ? 0 : visible ? 100 : 300,
      useNativeDriver: true,
    }).start();
  }, [opacity, preferences.reduceMotion, visible]);

  useEffect(() => {
    if (
      !isPlaying ||
      !visible ||
      panel ||
      scrubTime !== null ||
      preferences.controlsTimeout === 0
    )
      return;
    const timer = setTimeout(
      () => setVisible(false),
      preferences.controlsTimeout * 1_000,
    );
    return () => clearTimeout(timer);
  }, [
    interaction,
    isPlaying,
    panel,
    preferences.controlsTimeout,
    scrubTime,
    visible,
  ]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 1_000);
    return () => clearTimeout(timer);
  }, [feedback, interaction]);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (panel) {
          setPanel(null);
          return true;
        }
        if (locked) {
          setVisible(true);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [locked, panel]);

  const touchControls = () => {
    cancelPendingTap(tapTimer);
    setVisible(true);
    setInteraction((value) => value + 1);
  };
  const seek = (seconds: number) => {
    if (!canPlay || duration <= 0) return;
    seekPlayer(player, Math.max(0, Math.min(seconds, duration)));
  };
  const openPanel = (next: Panel) => {
    touchControls();
    setPanel(next);
  };
  const chooseFile = (file: TorrentVideo) => {
    setPanel(null);
    touchControls();
    onFileSelect(file);
  };
  const selectRate = (rate: number) => {
    setPlaybackRate(player, rate);
    setPanel(null);
    touchControls();
  };

  const tapVideo = (event: GestureResponderEvent) => {
    if (locked) {
      setVisible((value) => !value);
      return;
    }
    const zone = Math.floor(event.nativeEvent.locationX / (width / 3));
    const now = Date.now();
    if (now - lastTap.current.time < 280 && zone === lastTap.current.zone) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current.time = 0;
      if (zone === 1) {
        if (canPlay && preferences.doubleTapPlayPause) togglePlayback(player);
      } else {
        const amount =
          zone === 0 ? -preferences.doubleTapSeek : preferences.doubleTapSeek;
        seek(player.currentTime + amount);
        if (amount !== 0)
          setFeedback(
            `${amount > 0 ? "+" : "−"}${preferences.doubleTapSeek} seconds`,
          );
      }
      touchControls();
      return;
    }
    lastTap.current = { time: now, zone };
    tapTimer.current = setTimeout(() => setVisible((value) => !value), 280);
  };

  const moveVideo = (event: GestureResponderEvent) => {
    if (locked || !canPlay) return;
    const dx = event.nativeEvent.pageX - gestureStart.current.x;
    const dy = event.nativeEvent.pageY - gestureStart.current.y;
    if (!gestureMode.current && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      gestureMode.current = horizontal
        ? preferences.horizontalSeek
          ? "seek"
          : "disabled"
        : preferences.volumeGesture
          ? "volume"
          : "disabled";
      if (tapTimer.current) clearTimeout(tapTimer.current);
    }
    if (gestureMode.current === "seek") {
      const target = Math.max(
        0,
        Math.min(duration, gestureStart.current.time + (dx / width) * 120),
      );
      scrubTarget.current = target;
      setScrubTime(target);
      setFeedback(formatTime(target));
      touchControls();
    } else if (gestureMode.current === "volume") {
      setVolume(
        player,
        Math.max(0, Math.min(1, gestureStart.current.volume - dy / height)),
      );
      setFeedback(`Volume ${Math.round(player.volume * 100)}%`);
      touchControls();
    }
  };

  const updateScrub = (event: GestureResponderEvent) => {
    if (!canPlay || duration <= 0 || scrubWidth.current <= 0) return;
    const target =
      Math.max(
        0,
        Math.min(1, event.nativeEvent.locationX / scrubWidth.current),
      ) * duration;
    scrubTarget.current = target;
    setScrubTime(target);
    touchControls();
  };
  const cancelScrub = () => {
    scrubTarget.current = null;
    setScrubTime(null);
  };
  const finishScrub = () => {
    if (scrubTarget.current !== null) seek(scrubTarget.current);
    cancelScrub();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Video gestures: double tap to seek, swipe to seek or adjust volume"
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          gestureStart.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
            time: player.currentTime,
            volume: player.volume,
          };
          gestureMode.current = null;
        }}
        onResponderMove={moveVideo}
        onResponderRelease={(event) => {
          if (gestureMode.current === "seek") finishScrub();
          else if (!gestureMode.current) tapVideo(event);
        }}
        onResponderTerminate={cancelScrub}
      />
      <Animated.View
        style={[styles.overlay, { opacity }]}
        pointerEvents={visible ? "box-none" : "none"}
      >
        {!locked ? (
          <LinearGradient
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            colors={[
              "rgba(0,0,0,0.8)",
              "transparent",
              "transparent",
              "rgba(0,0,0,0.8)",
            ]}
            locations={[0, 0.25, 0.65, 1]}
          />
        ) : null}
        {!locked ? (
          <>
            <View
              style={[
                styles.top,
                {
                  paddingTop: Math.max(insets.top, 8),
                  paddingLeft: Math.max(insets.left, 16),
                  paddingRight: Math.max(insets.right, 16),
                },
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.titleRow}>
                <ControlButton
                  icon="arrow-back"
                  label="Back"
                  onPress={onBack}
                />
                <Pressable
                  style={styles.heading}
                  onPress={() => openPanel("files")}
                  accessibilityLabel="Open video list"
                >
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {selectedFile?.name ?? metadata?.name ?? "Torrent stream"}
                  </Text>
                </Pressable>
              </View>
              <View
                style={[styles.topActions, compact && styles.compactTopActions]}
              >
                <Switch
                  value={autoPlay}
                  onValueChange={(enabled) => {
                    touchControls();
                    onAutoPlayChange(enabled);
                  }}
                  accessibilityLabel="Automatically play the next file"
                  trackColor={{ false: "#666", true: theme.color.accent }}
                  thumbColor="#fff"
                />
                <ControlButton
                  icon="subtitles"
                  label="Subtitles"
                  onPress={() => openPanel("subtitles")}
                />
                <ControlButton
                  icon="audiotrack"
                  label="Audio tracks"
                  onPress={() => openPanel("audio")}
                />
                <ControlButton
                  icon="more-vert"
                  label="Player settings"
                  onPress={() => openPanel("settings")}
                />
              </View>
            </View>
            <View style={styles.middle} pointerEvents="box-none">
              <ControlButton
                icon="skip-previous"
                label="Previous video"
                size={48}
                disabled={filePosition <= 0 || isLoading}
                onPress={() => chooseFile(files[filePosition - 1])}
              />
              {isLoading ? (
                <ActivityIndicator
                  size="large"
                  color="#fff"
                  style={styles.playButton}
                />
              ) : (
                <ControlButton
                  icon={isPlaying ? "pause" : "play-arrow"}
                  label={isPlaying ? "Pause" : "Play"}
                  size={64}
                  large
                  disabled={!canPlay}
                  onPress={() => {
                    touchControls();
                    togglePlayback(player);
                  }}
                />
              )}
              <ControlButton
                icon="skip-next"
                label="Next video"
                size={48}
                disabled={
                  filePosition < 0 ||
                  filePosition >= files.length - 1 ||
                  isLoading
                }
                onPress={() => chooseFile(files[filePosition + 1])}
              />
            </View>
            <View
              style={[
                styles.bottom,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  paddingLeft: Math.max(insets.left, 16),
                  paddingRight: Math.max(insets.right, 16),
                },
              ]}
            >
              <View style={styles.bottomActions}>
                <View style={styles.actionGroup}>
                  <ControlButton
                    icon="lock-open"
                    label="Lock controls"
                    onPress={() => {
                      setLocked(true);
                      touchControls();
                    }}
                  />
                  <ControlButton
                    icon="screen-rotation"
                    label="Rotate player"
                    onPress={() => {
                      touchControls();
                      onRotate();
                    }}
                  />
                  <Pressable
                    style={styles.speedButton}
                    onPress={() =>
                      selectRate(playbackRate >= 2 ? 0.25 : playbackRate + 0.25)
                    }
                    onLongPress={() => openPanel("speed")}
                    accessibilityRole="button"
                    accessibilityLabel={`Playback speed ${playbackRate} times. Hold to choose speed`}
                  >
                    <Text style={styles.speedText}>{playbackRate}x</Text>
                  </Pressable>
                </View>
                <View style={styles.actionGroup}>
                  {preferences.introSkipSeconds > 0 ? (
                    <Pressable
                      style={styles.skipButton}
                      disabled={!canPlay}
                      onPress={() => {
                        seek(player.currentTime + preferences.introSkipSeconds);
                        touchControls();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Skip forward ${preferences.introSkipSeconds} seconds`}
                    >
                      <Text style={styles.skipText}>
                        +{preferences.introSkipSeconds} s
                      </Text>
                    </Pressable>
                  ) : null}
                  {supportsPictureInPicture ? (
                    <ControlButton
                      icon="picture-in-picture-alt"
                      label="Picture in picture"
                      disabled={!canPlay}
                      onPress={onPictureInPicture}
                    />
                  ) : null}
                  <ControlButton
                    icon="aspect-ratio"
                    label={`Video sizing: ${contentFit}`}
                    onPress={() => {
                      touchControls();
                      onContentFitChange();
                    }}
                  />
                </View>
              </View>
              <View style={styles.seekRow}>
                <Text style={styles.timer}>{formatTime(currentTime)}</Text>
                <View
                  style={styles.seekTouch}
                  onLayout={(event) => {
                    scrubWidth.current = event.nativeEvent.layout.width;
                  }}
                  onStartShouldSetResponder={() => canPlay}
                  onResponderGrant={updateScrub}
                  onResponderMove={updateScrub}
                  onResponderRelease={finishScrub}
                  onResponderTerminate={cancelScrub}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Video position"
                  accessibilityValue={{
                    min: 0,
                    max: Math.floor(duration || 0),
                    now: Math.floor(currentTime),
                    text: formatTime(currentTime),
                  }}
                  accessibilityActions={[
                    { name: "increment", label: "Forward 10 seconds" },
                    { name: "decrement", label: "Back 10 seconds" },
                  ]}
                  onAccessibilityAction={(event) => {
                    seek(
                      player.currentTime +
                        (event.nativeEvent.actionName === "increment"
                          ? 10
                          : -10),
                    );
                    touchControls();
                  }}
                >
                  <View style={styles.seekTrack} />
                  <View
                    style={[
                      styles.buffered,
                      {
                        width: `${percentage(time.bufferedPosition, duration)}%`,
                      },
                    ]}
                  />
                  <View style={[styles.progress, { width: `${progress}%` }]} />
                  <View style={[styles.thumb, { left: `${progress}%` }]} />
                </View>
                <Pressable
                  onPress={() => {
                    setRemaining((value) => !value);
                    touchControls();
                  }}
                  accessibilityLabel="Toggle duration and remaining time"
                  style={styles.durationButton}
                >
                  <Text style={styles.timer}>
                    {remaining
                      ? `−${formatTime(Math.max(0, duration - currentTime))}`
                      : formatTime(duration)}
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <View
            style={[
              styles.unlock,
              {
                left: Math.max(insets.left, 16),
                bottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <ControlButton
              icon="lock"
              label="Unlock controls"
              onPress={() => {
                setLocked(false);
                touchControls();
              }}
            />
          </View>
        )}
      </Animated.View>
      {feedback ? (
        <View style={styles.feedback} pointerEvents="none">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}
      {panel ? (
        <PlayerOptionsSheet
          panel={panel}
          player={player}
          contentFit={contentFit}
          files={files}
          selectedFile={selectedFile}
          onClose={() => {
            setPanel(null);
            touchControls();
          }}
          onPanelChange={setPanel}
          onRateSelect={selectRate}
          onFileSelect={chooseFile}
          onContentFitChange={onContentFitChange}
          onOpenPreferences={() => {
            setPanel(null);
            onOpenPreferences();
          }}
        />
      ) : null}
    </View>
  );
}

function cancelPendingTap(
  timer: React.RefObject<ReturnType<typeof setTimeout> | null>,
) {
  if (timer.current) clearTimeout(timer.current);
}

function togglePlayback(player: VideoPlayer) {
  if (player.playing) player.pause();
  else {
    if (player.duration > 0 && player.currentTime >= player.duration - 0.25) {
      seekPlayer(player, 0);
    }
    player.play();
  }
}

function seekPlayer(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}
function setVolume(player: VideoPlayer, volume: number) {
  player.volume = volume;
}
function setPlaybackRate(player: VideoPlayer, rate: number) {
  player.playbackRate = rate;
}

function percentage(value: number, total: number) {
  return total > 0 && Number.isFinite(value)
    ? Math.max(0, Math.min(value / total, 1)) * 100
    : 0;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  const padded = (value: number) => value.toString().padStart(2, "0");
  return `${hours > 0 ? `${padded(hours)}:` : ""}${padded(minutes)}:${padded(remainder)}`;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 180,
    gap: 8,
  },
  heading: { flex: 1, gap: 2 },
  title: { color: "#fff", fontSize: 16 },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontStyle: "italic",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
  },
  compactTopActions: {
    width: "100%",
    justifyContent: "flex-end",
    paddingTop: 4,
  },
  playButton: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 48,
  },
  middle: {
    position: "absolute",
    top: "50%",
    marginTop: -48,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
  },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bottomActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  speedButton: {
    minWidth: 56,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  speedText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  skipButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: theme.color.accent,
  },
  skipText: { color: theme.color.background, fontSize: 14, fontWeight: "600" },
  seekRow: { flexDirection: "row", alignItems: "center", gap: 12, height: 48 },
  timer: {
    color: "#fff",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    minWidth: 52,
    textAlign: "center",
  },
  durationButton: { minHeight: 48, justifyContent: "center" },
  seekTouch: { flex: 1, height: 48, justifyContent: "center" },
  seekTrack: { height: 4, borderRadius: 4, backgroundColor: "#444" },
  buffered: {
    position: "absolute",
    height: 4,
    borderRadius: 4,
    backgroundColor: "#b9b1c9",
  },
  progress: {
    position: "absolute",
    height: 4,
    borderRadius: 4,
    backgroundColor: theme.color.accent,
  },
  thumb: {
    position: "absolute",
    height: 12,
    width: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: theme.color.accent,
  },
  unlock: {
    position: "absolute",
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  feedback: {
    position: "absolute",
    alignSelf: "center",
    top: "35%",
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  feedbackText: { color: "#fff", fontSize: 20, fontWeight: "600" },
});
