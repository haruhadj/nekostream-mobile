import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEvent } from "expo";
import type {
  AudioTrack,
  SubtitleTrack,
  VideoContentFit,
  VideoPlayer,
} from "expo-video";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatBytes } from "@shared/format";
import type { TorrentVideo } from "../../../modules/neko-torrent/src/NekoTorrentModule";
import { theme } from "@/theme";
import { ControlButton } from "./control-button";

export type PlayerPanel =
  "audio" | "subtitles" | "speed" | "files" | "settings";
type Props = {
  panel: PlayerPanel;
  player: VideoPlayer;
  contentFit: VideoContentFit;
  files: TorrentVideo[];
  selectedFile: TorrentVideo | null;
  onClose: () => void;
  onPanelChange: (panel: PlayerPanel) => void;
  onRateSelect: (rate: number) => void;
  onFileSelect: (file: TorrentVideo) => void;
  onContentFitChange: () => void;
  onOpenPreferences: () => void;
};

export function PlayerOptionsSheet({
  panel,
  player,
  contentFit,
  files,
  selectedFile,
  onClose,
  onPanelChange,
  onRateSelect,
  onFileSelect,
  onContentFitChange,
  onOpenPreferences,
}: Props) {
  const insets = useSafeAreaInsets();
  const { playbackRate } = useEvent(player, "playbackRateChange", {
    playbackRate: player.playbackRate,
  });
  const { audioTrack } = useEvent(player, "audioTrackChange", {
    audioTrack: player.audioTrack,
  });
  const { subtitleTrack } = useEvent(player, "subtitleTrackChange", {
    subtitleTrack: player.subtitleTrack,
  });
  const { availableAudioTracks: audioTracks } = useEvent(
    player,
    "availableAudioTracksChange",
    { availableAudioTracks: player.availableAudioTracks },
  );
  const { availableSubtitleTracks: subtitles } = useEvent(
    player,
    "availableSubtitleTracksChange",
    { availableSubtitleTracks: player.availableSubtitleTracks },
  );
  return (
    <View style={styles.sheetBackdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => onClose()}
        accessibilityLabel="Dismiss player settings"
      />
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{panelTitle(panel)}</Text>
          <ControlButton
            icon="close"
            label="Close settings"
            onPress={() => onClose()}
          />
        </View>
        <ScrollView style={styles.options}>
          {panel === "settings" ? (
            <>
              <Option
                label="Playback speed"
                detail={`${playbackRate}x`}
                onPress={() => onPanelChange("speed")}
              />
              <Option
                label="Subtitles"
                detail={
                  subtitleTrack?.label ?? subtitleTrack?.language ?? "Off"
                }
                onPress={() => onPanelChange("subtitles")}
              />
              <Option
                label="Audio"
                detail={audioTrack?.label ?? audioTrack?.language ?? "Default"}
                onPress={() => onPanelChange("audio")}
              />
              <Option
                label="Video list"
                detail={`${files.length} files`}
                onPress={() => onPanelChange("files")}
              />
              <Option
                label="Video sizing"
                detail={contentFit}
                onPress={onContentFitChange}
              />
              <Option
                label="Player and torrent preferences"
                detail="Defaults, gestures, language, and streaming"
                onPress={onOpenPreferences}
              />
            </>
          ) : null}
          {panel === "speed"
            ? [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((rate) => (
                <Option
                  key={rate}
                  label={`${rate}x`}
                  selected={playbackRate === rate}
                  onPress={() => onRateSelect(rate)}
                />
              ))
            : null}
          {panel === "audio" ? (
            audioTracks.length ? (
              audioTracks.map((track, index) => (
                <Option
                  key={track.id ?? index}
                  label={track.label || track.language || `Audio ${index + 1}`}
                  selected={audioTrack?.id === track.id}
                  onPress={() => {
                    setAudioTrack(player, track);
                    onClose();
                  }}
                />
              ))
            ) : (
              <Text style={styles.hint}>
                No alternate audio tracks available.
              </Text>
            )
          ) : null}
          {panel === "subtitles" ? (
            <>
              <Option
                label="Off"
                selected={subtitleTrack === null}
                onPress={() => {
                  setSubtitleTrack(player, null);
                  onClose();
                }}
              />
              {subtitles.map((track, index) => (
                <Option
                  key={track.id ?? index}
                  label={
                    track.label || track.language || `Subtitle ${index + 1}`
                  }
                  selected={subtitleTrack?.id === track.id}
                  onPress={() => {
                    setSubtitleTrack(player, track);
                    onClose();
                  }}
                />
              ))}
              {!subtitles.length ? (
                <Text style={styles.hint}>
                  No embedded subtitles available.
                </Text>
              ) : null}
            </>
          ) : null}
          {panel === "files"
            ? files.map((file) => (
                <Option
                  key={file.index}
                  label={file.name}
                  detail={formatBytes(file.size) ?? undefined}
                  selected={selectedFile?.index === file.index}
                  onPress={() => onFileSelect(file)}
                />
              ))
            : null}
        </ScrollView>
      </View>
    </View>
  );
}

function setAudioTrack(player: VideoPlayer, track: AudioTrack) {
  player.audioTrack = track;
}
function setSubtitleTrack(player: VideoPlayer, track: SubtitleTrack | null) {
  player.subtitleTrack = track;
}

function Option({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <MaterialIcons
        name={selected ? "radio-button-checked" : "radio-button-unchecked"}
        color={selected ? theme.color.accent : "#aaa"}
        size={22}
      />
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

function panelTitle(panel: PlayerPanel) {
  return {
    audio: "Audio tracks",
    subtitles: "Subtitles",
    speed: "Playback speed",
    files: "Video list",
    settings: "Player settings",
  }[panel];
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: "rgba(255,255,255,0.12)" },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "85%",
    backgroundColor: "#211f26",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#938f99",
    alignSelf: "center",
    marginTop: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  sheetTitle: { color: "#fff", fontSize: 22 },
  options: { flexGrow: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    minHeight: 56,
    paddingVertical: 12,
    borderRadius: 8,
  },
  optionText: { flex: 1, gap: 4 },
  optionLabel: { color: "#fff", fontSize: 16 },
  optionDetail: { color: "#aaa", fontSize: 13 },
  hint: { color: "#aaa", fontSize: 14, lineHeight: 21, paddingVertical: 16 },
});
