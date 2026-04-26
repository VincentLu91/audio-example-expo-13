import { Text, Button, StyleSheet } from "react-native";
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

  return (
    <Screen>
      <Text style={styles.title}>Player Screen</Text>

      <Text>Status: {status.playing ? "Playing" : "Paused"}</Text>
      <Text>
        Time: {formatTime(status.currentTime)} / {formatTime(status.duration)}
      </Text>

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
});
