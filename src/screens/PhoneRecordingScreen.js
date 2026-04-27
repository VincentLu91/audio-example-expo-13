import { Pressable, StyleSheet, Text, View } from "react-native";

import Screen from "../components/Screen";

export default function PhoneRecordingScreen({ navigation }) {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Phone Recording</Text>

        <Text style={styles.subtitle}>
          Capture or import a phone-call-style recording, then transcribe it.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recording status</Text>
          <Text style={styles.statusText}>Not started</Text>
          <Text style={styles.cardDescription}>
            Recording logic is not connected yet. This screen is ready for the
            next wiring step.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What this will save</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>Phone call</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transcript</Text>
            <Text style={styles.detailValue}>Generated after recording</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Library</Text>
            <Text style={styles.detailValue}>Home recordings list</Text>
          </View>
        </View>

        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Start phone recording</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Back to recordings</Text>
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
    color: "#4b5563",
    lineHeight: 22,
  },

  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "white",
    gap: 10,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  statusText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  cardDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  detailLabel: {
    fontSize: 14,
    color: "#6b7280",
  },

  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },

  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },

  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
});
