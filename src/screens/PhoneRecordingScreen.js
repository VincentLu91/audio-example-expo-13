import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";

import Screen from "../components/Screen";
import { startPhoneCall } from "../services/phoneCallService";

export default function PhoneRecordingScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [filename, setFilename] = useState("");

  const [callStatus, setCallStatus] = useState("Not started");
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isStartingCall, setIsStartingCall] = useState(false);

  const callsAvailable = null;

  async function handleStartPhoneRecording() {
    if (isStartingCall) {
      return;
    }

    const cleanedPhoneNumber = phoneNumber.trim();

    if (!cleanedPhoneNumber) {
      setErrorMessage("Enter a phone number first.");
      setCallStatus("Missing phone number");
      return;
    }

    setErrorMessage("");
    setIsStartingCall(true);
    setCallStatus("Starting call...");

    try {
      const result = await startPhoneCall({
        phoneNumber: cleanedPhoneNumber,
        filename,
      });

      console.log("Phone call service result:", result);

      setCallStatus("Call start requested");
    } catch (error) {
      console.error("Failed to start phone recording:", error);
      setErrorMessage("Could not start the phone recording.");
      setCallStatus("Failed to start");
    } finally {
      setIsStartingCall(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Phone Recording</Text>

        <Text style={styles.subtitle}>
          Dial a phone number through your backend, capture the transcript, then
          save it to your recordings list.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Call setup</Text>

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.helperText}>
            Phone validation and dialing logic will be connected later.
          </Text>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Call availability</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Calls available</Text>
            <Text style={styles.detailValue}>
              {callsAvailable === null ? "Not checked yet" : callsAvailable}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Plan status</Text>
            <Text style={styles.detailValue}>Not connected yet</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recording status</Text>

          <Text style={styles.statusText}>{callStatus}</Text>

          <Text style={styles.cardDescription}>
            Later this will show whether the call is dialing, recording,
            transcribing, completed, or failed.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live transcript</Text>

          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>
              {transcript ||
                "Transcript will appear here while the call is active."}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Save recording</Text>

          <Text style={styles.label}>Recording name</Text>
          <TextInput
            value={filename}
            onChangeText={setFilename}
            placeholder="Name this recording"
            style={styles.input}
          />

          <Text style={styles.helperText}>
            This section will be used after the call is complete.
          </Text>
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            isStartingCall && styles.primaryButtonDisabled,
          ]}
          onPress={handleStartPhoneRecording}
          disabled={isStartingCall}
        >
          <Text style={styles.primaryButtonText}>
            {isStartingCall ? "Starting..." : "Start phone recording"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Back to recordings</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
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

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#f9fafb",
  },

  helperText: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
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

  transcriptBox: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
  },

  transcriptText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },

  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryButtonDisabled: {
    opacity: 0.6,
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
  errorText: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "600",
  },
});
