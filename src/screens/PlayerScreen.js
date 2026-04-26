import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Slider from "@react-native-community/slider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";

import Screen from "../components/Screen";

const audioSource =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

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
      <Ionicons name="play-circle" size={48} color="white" />
      <Text style={styles.playerButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function PlayerScreen() {
  const [fontsLoaded] = useFonts(Ionicons.font);

  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const duration = status.duration || 0;
  const currentTime = isSeeking ? seekValue : status.currentTime || 0;

  return (
    <Screen>
      <View style={styles.playerCard}>
        <Text style={styles.title}>Audio Player</Text>
        <Ionicons name="play-circle" size={48} color="white" />

        <Text style={styles.statusText}></Text>

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
            label={status.playing ? "Pause" : "Play"}
            iconName={status.playing ? "pause" : "play-arrow"}
            onPress={() => {
              if (status.playing) {
                player.pause();
              } else {
                player.play();
              }
            }}
          />

          <PlayerButton
            label="Restart"
            onPress={async () => {
              await player.seekTo(0);
              player.play();
            }}
          />
        </View>

        <View style={styles.controlsRow}>
          <PlayerButton
            label="-10s"
            onPress={async () => {
              await player.seekTo(Math.max(currentTime - 10, 0));
            }}
          />

          <PlayerButton
            label="+10s"
            onPress={async () => {
              await player.seekTo(Math.min(currentTime + 10, duration));
            }}
          />
        </View>
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
});
