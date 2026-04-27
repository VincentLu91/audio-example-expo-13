import { Pressable, StyleSheet, Text, View } from "react-native";

import Screen from "../components/Screen";

export default function PhoneRecordingScreen({ navigation }) {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Phone Recording</Text>

        <Text style={styles.subtitle}>
          This screen will handle phone-call-style recordings later.
        </Text>

        <Text style={styles.note}>
          For now, this is just a placeholder so we can wire the app flow safely
          before adding recording logic.
        </Text>

        <Pressable style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 16,
    color: "#374151",
  },

  note: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },

  button: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
