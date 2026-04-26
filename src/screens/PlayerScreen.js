import { View, Text, Button, StyleSheet, Pressable } from "react-native";
import { useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

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

export default function PlayerScreen() {
  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  const [progressBarWidth, setProgressBarWidth] = useState(0);

  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const progressPercent = `${progress * 100}%`;

  function handleSeek(event) {
    if (!duration || duration <= 0 || progressBarWidth <= 0) {
      return;
    }

    const tapX = event.nativeEvent.locationX;
    const seekRatio = Math.max(0, Math.min(tapX / progressBarWidth, 1));
    const seekTime = seekRatio * duration;

    player.seekTo(seekTime);
  }

  return (
    <Screen>
      <Text style={styles.title}>Player Screen</Text>

      <Text>Status: {status.playing ? "Playing" : "Paused"}</Text>
      <View style={styles.timeRow}>
        <Text>{formatTime(currentTime)}</Text>
        <Text>{formatTime(duration)}</Text>
      </View>
      <Pressable
        style={styles.progressTrack}
        onLayout={(event) => {
          setProgressBarWidth(event.nativeEvent.layout.width);
        }}
        onPress={handleSeek}
      >
        <View style={[styles.progressFill, { width: progressPercent }]} />
      </Pressable>

      <Button
        title={status.playing ? "Pause" : "Play"}
        onPress={() => {
          if (status.playing) {
            player.pause();
          } else {
            player.play();
          }
        }}
      />
      <Button
        title="-10s"
        onPress={() => {
          const nextTime = Math.max(0, status.currentTime - 10);
          player.seekTo(nextTime);
        }}
      />

      <Button
        title="+10s"
        onPress={() => {
          const duration = status.duration || 0;
          const nextTime = Math.min(duration, status.currentTime + 10);
          player.seekTo(nextTime);
        }}
      />
      <Button
        title="Restart"
        onPress={() => {
          player.seekTo(0);
          player.play();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },
  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 6,
  },
  progressTrack: {
    width: "100%",
    height: 12,
    backgroundColor: "#ddd",
    borderRadius: 999,
    overflow: "hidden",
    marginVertical: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#333",
    borderRadius: 999,
  },
});
