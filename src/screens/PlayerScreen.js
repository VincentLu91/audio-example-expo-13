import { Text, Button, StyleSheet } from "react-native";
import { useAudioPlayer } from "expo-audio";

import Screen from "../components/Screen";

const audioSource =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

export default function PlayerScreen() {
  const player = useAudioPlayer(audioSource);

  return (
    <Screen>
      <Text style={styles.title}>Player Screen</Text>

      <Button title="Play" onPress={() => player.play()} />
      <Button title="Pause" onPress={() => player.pause()} />
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
