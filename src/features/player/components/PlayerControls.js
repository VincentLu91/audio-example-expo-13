import { View, Button, StyleSheet } from "react-native";

export default function PlayerControls() {
  return (
    <View style={styles.container}>
      <Button title="Previous" onPress={() => {}} />
      <Button title="Play" onPress={() => {}} />
      <Button title="Next" onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 24,
  },
});
