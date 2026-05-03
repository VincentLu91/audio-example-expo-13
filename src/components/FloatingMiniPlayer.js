import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../theme/theme";

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function FloatingMiniPlayer({
  playbackState,
  bottomOffset,
  onTogglePlayback,
  onStopPlayback,
  onSeekPlayback,
  onOpenPlayer,
}) {
  const activeRecording = playbackState?.activeRecording;

  if (!activeRecording) {
    return null;
  }

  const title =
    activeRecording.file_name ||
    activeRecording.original_file_name ||
    "Untitled recording";

  const currentTime = playbackState?.currentTime || 0;
  const duration = playbackState?.duration || 0;
  const isPlaying = Boolean(playbackState?.isPlaying);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom: bottomOffset }]}
    >
      <View style={styles.player}>
        <View style={styles.mainRow}>
          <Pressable
            style={styles.playButton}
            onPress={onTogglePlayback}
            hitSlop={8}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={22}
              color={theme.colors.white}
            />
          </Pressable>

          <Pressable style={styles.textBlock} onPress={onOpenPlayer}>
            <Text style={styles.status}>
              {isPlaying ? "Now playing" : "Paused"}
            </Text>

            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </Pressable>

          <Pressable
            style={styles.stopButton}
            onPress={onStopPlayback}
            hitSlop={8}
          >
            <Ionicons
              name="close"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.progressBlock}>
          <Slider
            style={styles.slider}
            value={currentTime}
            minimumValue={0}
            maximumValue={duration || 1}
            minimumTrackTintColor={theme.colors.purpleSoft}
            maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.purpleSoft}
            onSlidingComplete={onSeekPlayback}
          />

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 30,
    backgroundColor: "transparent",
  },

  player: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    overflow: "hidden",
  },

  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },

  playButton: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    flex: 1,
    minWidth: 0,
  },

  status: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.purpleSoft,
    marginBottom: 2,
  },

  title: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },

  stopButton: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },

  progressBlock: {
    marginTop: 4,
  },

  slider: {
    width: "100%",
    height: 28,
  },

  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },

  timeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
});
