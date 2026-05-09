import { useEffect, useRef, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  useAudioPlayerStatus,
} from "expo-audio";
import Slider from "@react-native-community/slider";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";

import Screen from "../components/Screen";
import { ROUTES } from "../constants/routes";
import { theme } from "../theme/theme";
import { supabase } from "../../lib/supabase";
import {
  getPlaybackState,
  registerPlaybackHandlers,
  setActivePlaybackRecording,
  setActivePlaybackIsPlaying,
  setActivePlaybackStatus,
} from "../services/playbackControlService";
import { MicTranscriptionService } from "../services/micTranscriptionService";
import { generateSavedRecap } from "../services/chatAgentService";

const sharedPlaybackPlayer = createAudioPlayer(null);
let loadedPlaybackSource = null;

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function IconControlButton({ iconName, onPress, primary = false }) {
  return (
    <Pressable
      style={[styles.controlButton, primary && styles.controlButtonPrimary]}
      onPress={onPress}
    >
      <Ionicons
        name={iconName}
        size={primary ? 34 : 24}
        color={theme.colors.textPrimary}
      />
    </Pressable>
  );
}

export default function PlayerScreen({ route, navigation }) {
  const recording = route?.params?.recording;

  const audioSource = recording?.original_file_name
    ? supabase.storage
        .from("recreate-ai-storage-bucket")
        .getPublicUrl(recording.original_file_name).data.publicUrl
    : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

  const player = sharedPlaybackPlayer;
  const status = useAudioPlayerStatus(player);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  const transcriptCopyTimeoutRef = useRef(null);

  const [recap, setRecap] = useState(recording?.recap || null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState("");
  const [activePanel, setActivePanel] = useState("player");

  const duration = status.duration || 0;
  const currentTime = isSeeking ? seekValue : status.currentTime || 0;
  const transcriptText = recording?.full_transcript?.trim() || "";

  useEffect(() => {
    if (!audioSource) return;

    if (loadedPlaybackSource !== audioSource) {
      player.pause();
      player.replace(audioSource);
      loadedPlaybackSource = audioSource;
    }
  }, [audioSource, player]);

  useEffect(() => {
    if (recording) {
      setActivePlaybackRecording(recording);
    }
  }, [recording]);

  useEffect(() => {
    setActivePlaybackStatus({
      isPlaying: status.playing,
      currentTime: status.currentTime || 0,
      duration: status.duration || 0,
    });
  }, [status.playing, status.currentTime, status.duration]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  }, []);

  useEffect(() => {
    registerPlaybackHandlers({
      stop: async () => {
        player.pause();
        player.setActiveForLockScreen(false);
        setActivePlaybackIsPlaying(false);
      },

      togglePlayPause: async () => {
        const nextIsPlaying = !getPlaybackState().isPlaying;

        if (nextIsPlaying) {
          await stopMicRecordingBeforePlayback();

          player.setActiveForLockScreen(true, {
            title: recording?.file_name || "Recording",
            artist: "Audio App",
          });

          player.play();
        } else {
          player.pause();
          player.setActiveForLockScreen(false);
        }

        setActivePlaybackIsPlaying(nextIsPlaying);
      },

      seekTo: async (value) => {
        await player.seekTo(value);
      },
    });
  }, [player, recording]);

  useEffect(() => {
    return () => {
      if (transcriptCopyTimeoutRef.current) {
        clearTimeout(transcriptCopyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setRecap(recording?.recap || null);
    setRecapError("");
  }, [recording?.id, recording?.recap]);

  async function stopMicRecordingBeforePlayback() {
    const micState = MicTranscriptionService.getState();

    if (
      micState.isRecording ||
      ["recording", "connected"].includes(micState.recordingStatus)
    ) {
      await MicTranscriptionService.stopRecording();
    }
  }

  async function handlePlayPause() {
    if (status.playing) {
      player.pause();
      player.setActiveForLockScreen(false);
      setActivePlaybackIsPlaying(false);
      return;
    }

    await stopMicRecordingBeforePlayback();

    player.setActiveForLockScreen(true, {
      title: recording?.file_name || "Recording",
      artist: "Audio App",
    });

    player.play();
    setActivePlaybackIsPlaying(true);
  }

  async function restartPlayback() {
    await stopMicRecordingBeforePlayback();
    await player.seekTo(0);

    player.setActiveForLockScreen(true, {
      title: recording?.file_name || "Recording",
      artist: "Audio App",
    });

    player.play();
    setActivePlaybackIsPlaying(true);
  }

  async function copyTranscriptToClipboard() {
    if (!transcriptText) return;

    await Clipboard.setStringAsync(transcriptText);
    setTranscriptCopied(true);

    if (transcriptCopyTimeoutRef.current) {
      clearTimeout(transcriptCopyTimeoutRef.current);
    }

    transcriptCopyTimeoutRef.current = setTimeout(() => {
      setTranscriptCopied(false);
    }, 1600);
  }

  async function handleGenerateRecap() {
    if (!recording || !transcriptText || recapLoading) {
      return;
    }

    setRecapLoading(true);
    setRecapError("");

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user?.id) {
        throw new Error("Could not load current user.");
      }

      const generatedRecap = await generateSavedRecap({
        recording,
        transcriptText,
        soundUrl: audioSource,
        userId: user.id,
      });

      setRecap(generatedRecap);
    } catch (error) {
      console.error("Generate recap error:", error?.message || error);
      setRecapError("Could not generate recap. Please try again.");
    } finally {
      setRecapLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.playerShell}>
          <View style={styles.panelTabs}>
            <Pressable
              style={[
                styles.panelTab,
                activePanel === "player" && styles.panelTabActive,
              ]}
              onPress={() => setActivePanel("player")}
            >
              <Text
                style={[
                  styles.panelTabText,
                  activePanel === "player" && styles.panelTabTextActive,
                ]}
              >
                Player
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.panelTab,
                activePanel === "recap" && styles.panelTabActive,
              ]}
              onPress={() => setActivePanel("recap")}
            >
              <Text
                style={[
                  styles.panelTabText,
                  activePanel === "recap" && styles.panelTabTextActive,
                ]}
              >
                Recap
              </Text>
            </Pressable>
          </View>
          <View style={styles.transcriptFrame}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptHeaderTitle}>Transcript</Text>

              <View style={styles.transcriptActions}>
                <Pressable
                  style={styles.copyButton}
                  onPress={() =>
                    navigation.navigate(ROUTES.EDIT_RECORDING, {
                      recording,
                    })
                  }
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color={theme.colors.textPrimary}
                  />
                  <Text style={styles.copyButtonText}>Edit</Text>
                </Pressable>

                {transcriptText ? (
                  <Pressable
                    style={styles.copyButton}
                    onPress={copyTranscriptToClipboard}
                  >
                    <Ionicons
                      name="copy-outline"
                      size={14}
                      color={theme.colors.textPrimary}
                    />
                    <Text style={styles.copyButtonText}>
                      {transcriptCopied ? "Copied" : "Copy"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.transcriptScroll}
              contentContainerStyle={styles.transcriptScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text
                style={[
                  styles.transcriptText,
                  !transcriptText && styles.transcriptEmptyText,
                ]}
              >
                {transcriptText || "No transcript found for this recording."}
              </Text>
            </ScrollView>
          </View>

          {activePanel === "recap" && recap ? (
            <View style={styles.recapFrame}>
              <Text style={styles.recapTitle}>Recap</Text>
              <Text style={styles.recapText}>
                {recap.summary || "Recap saved for this recording."}
              </Text>
            </View>
          ) : recapError ? (
            <Text style={styles.recapErrorText}>{recapError}</Text>
          ) : null}

          <Text style={styles.trackTitle}>
            {recording?.file_name || "Audio Player"}
          </Text>

          <Text style={styles.artistText}>
            {recording?.recordingType === "call"
              ? "Phone recording"
              : "Mic recording"}
          </Text>

          <View style={styles.controlsRow}>
            <IconControlButton iconName="refresh" onPress={restartPlayback} />

            <IconControlButton
              iconName="play-skip-back"
              onPress={async () => {
                await player.seekTo(Math.max(currentTime - 10, 0));
              }}
            />

            <IconControlButton
              iconName={status.playing ? "pause" : "play"}
              primary
              onPress={handlePlayPause}
            />

            <IconControlButton
              iconName="play-skip-forward"
              onPress={async () => {
                await player.seekTo(Math.min(currentTime + 10, duration));
              }}
            />

            <IconControlButton
              iconName="chatbubble-ellipses-outline"
              onPress={() =>
                navigation.navigate(ROUTES.CHATBOT, {
                  recording,
                })
              }
            />
          </View>

          <View style={styles.progressSection}>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration || 1}
              value={currentTime}
              minimumTrackTintColor={theme.colors.purpleSoft}
              maximumTrackTintColor={theme.colors.surfaceMuted}
              thumbTintColor={theme.colors.textPrimary}
              onSlidingStart={() => {
                setIsSeeking(true);
                setSeekValue(status.currentTime || 0);
              }}
              onValueChange={(value) => {
                setSeekValue(value);
              }}
              onSlidingComplete={async (value) => {
                setSeekValue(value);
                await player.seekTo(value);

                setTimeout(() => {
                  setIsSeeking(false);
                }, 200);
              }}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: "100%",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: theme.spacing.lg,
  },

  playerShell: {
    width: "100%",
    borderRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },

  transcriptFrame: {
    width: "100%",
    height: 320,
    borderRadius: 24,
    padding: 16,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 28,
  },

  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  transcriptHeaderTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.textPrimary,
  },

  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  transcriptActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  copyButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },

  transcriptScroll: {
    flex: 1,
    width: "100%",
  },

  transcriptScrollContent: {
    paddingBottom: 8,
  },

  transcriptText: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    textAlign: "center",
  },

  transcriptEmptyText: {
    color: theme.colors.textMuted,
  },

  trackTitle: {
    ...theme.typography.title,
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },

  artistText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 28,
  },

  controlsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },

  controlButtonPrimary: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  progressSection: {
    width: "100%",
  },

  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  timeText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },

  slider: {
    width: "100%",
    height: 36,
  },

  recapFrame: {
    width: "100%",
    borderRadius: 24,
    padding: 16,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },

  recapTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },

  recapText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },

  recapErrorText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },

  panelTabs: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },

  panelTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
  },

  panelTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
  },

  panelTabText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },

  panelTabTextActive: {
    color: theme.colors.textPrimary,
  },
});
