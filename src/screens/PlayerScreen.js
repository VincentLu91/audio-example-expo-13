import { useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Slider from "@react-native-community/slider";

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
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const duration = status.duration || 0;
  const currentTime = isSeeking ? seekValue : status.currentTime || 0;

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
          const nextTime = Math.max(0, currentTime - 10);
          player.seekTo(nextTime);
        }}
      />

      <Button
        title="+10s"
        onPress={() => {
          const nextTime = Math.min(duration, currentTime + 10);
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

  progressTouchArea: {
    width: "100%",
    height: 28,
    justifyContent: "center",
    marginVertical: 16,
  },

  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#ddd",
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#333",
    borderRadius: 999,
  },

  progressThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#333",
    marginLeft: -8,
  },
  slider: {
    width: "100%",
    height: 40,
    marginTop: 8,
    marginBottom: 8,
  },
});
