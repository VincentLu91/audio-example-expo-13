import { useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Slider from "@react-native-community/slider";
import Ionicons from "@expo/vector-icons/Ionicons";

import Screen from "../components/Screen";
import { supabase } from "../../lib/supabase";

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PlayerButton({ label, iconName, onPress }) {
  return (
    <Pressable style={styles.playerButton} onPress={onPress}>
      {iconName ? (
        <Ionicons
          name={iconName}
          size={iconName.includes("circle") ? 30 : 22}
          color="white"
        />
      ) : (
        <Text style={styles.playerButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export default function PlayerScreen({ route }) {
  const recording = route?.params?.recording;

  const audioSource = recording?.original_file_name
    ? supabase.storage
        .from("recreate-ai-storage-bucket")
        .getPublicUrl(recording.original_file_name).data.publicUrl
    : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  const source = recording?.original_file_name || audioSource;
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const duration = status.duration || 0;
  const currentTime = isSeeking ? seekValue : status.currentTime || 0;
  const transcriptText = recording?.full_transcript?.trim() || "";

  return (
    <Screen>
      <View style={styles.playerCard}>
        <Text style={styles.title}>Audio Player</Text>
        {recording && (
          <>
            <Text>Selected recording:</Text>
            <Text>{recording.file_name || "Untitled recording"}</Text>
            <Text>Type: {recording.recordingType}</Text>
          </>
        )}

        <Text style={styles.statusText}>
          Status: {status.playing ? "Playing" : "Paused"}
        </Text>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={Math.min(currentTime, duration || 1)}
          minimumTrackTintColor="#4f46e5"
          maximumTrackTintColor="#d1d5db"
          thumbTintColor="#4f46e5"
          disabled={!duration}
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

        <View style={styles.controlsRow}>
          <PlayerButton
            iconName={status.playing ? "pause-circle" : "play-circle"}
            onPress={() => {
              if (status.playing) {
                player.pause();
              } else {
                player.play();
              }
            }}
          />

          <PlayerButton
            iconName="refresh"
            onPress={async () => {
              await player.seekTo(0);
              player.play();
            }}
          />
        </View>

        <View style={styles.controlsRow}>
          <PlayerButton
            iconName="play-back"
            onPress={async () => {
              await player.seekTo(Math.max(currentTime - 10, 0));
            }}
          />

          <PlayerButton
            iconName="play-forward"
            onPress={async () => {
              await player.seekTo(Math.min(currentTime + 10, duration));
            }}
          />
        </View>
      </View>
      <View style={styles.transcriptCard}>
        <Text style={styles.transcriptTitle}>Transcript</Text>

        {transcriptText ? (
          <ScrollView style={styles.transcriptScroll}>
            <Text style={styles.transcriptText}>{transcriptText}</Text>
          </ScrollView>
        ) : (
          <Text style={styles.emptyTranscriptText}>
            No transcript found for this recording.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },

  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 6,
  },

  slider: {
    width: "100%",
    height: 40,
    marginTop: 8,
    marginBottom: 8,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },

  playerButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    alignItems: "center",
  },

  playerButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  playerCard: {
    width: "100%",
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    gap: 8,
  },
  statusText: {
    color: "#d1d5db",
    fontSize: 16,
  },

  timeText: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "500",
  },
  transcriptCard: {
    width: "100%",
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },
  transcriptTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  transcriptScroll: {
    maxHeight: 260,
  },
  transcriptText: {
    color: "#e5e7eb",
    fontSize: 15,
    lineHeight: 22,
  },
  emptyTranscriptText: {
    color: "#9ca3af",
    fontSize: 15,
  },
});
