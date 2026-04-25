import { Text, StyleSheet } from "react-native";
import Screen from "../components/Screen";
import PlayerControls from "../features/player/components/PlayerControls";

export default function PlayerScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Player Screen</Text>
      <PlayerControls />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
});
