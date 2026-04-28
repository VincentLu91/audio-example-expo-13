import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";

import Screen from "../components/Screen";
import { startPhoneCall } from "../services/phoneCallService";
import { PhoneTranscriptionService } from "../services/phoneTranscriptionService";
import { supabase } from "../../lib/supabase";

function getCallSessionStatusLabel(status) {
  if (status === "call_start_requested") {
    return "Call start requested";
  }

  if (status === "dialing") {
    return "Dialing";
  }

  if (status === "recording") {
    return "Recording";
  }

  if (status === "transcribing") {
    return "Transcribing";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Unknown";
}

function formatCallStartedAt(startedAt) {
  if (!startedAt) {
    return "Unknown";
  }

  const date = new Date(startedAt);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function SessionRow({ label, value }) {
  return (
    <View style={styles.sessionRow}>
      <Text style={styles.sessionLabel}>{label}</Text>
      <Text style={styles.sessionValue}>{value}</Text>
    </View>
  );
}

export default function PhoneRecordingScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [filename, setFilename] = useState("");

  const [callStatus, setCallStatus] = useState("Not started");
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isStartingCall, setIsStartingCall] = useState(false);
  const isStartingCallRef = useRef(false);
  const [callSession, setCallSession] = useState(null);
  const [phoneTranscription, setPhoneTranscription] = useState(
    PhoneTranscriptionService.getState(),
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = PhoneTranscriptionService.subscribe(
      setPhoneTranscription,
    );

    return unsubscribe;
  }, []);

  const callsAvailable = null;
  const completedRecording = phoneTranscription.callRecordingInfo;
  const isPhoneRecordingComplete =
    phoneTranscription.callStatus === "completed" && completedRecording;

  async function handleSavePhoneRecording() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const cleanedFilename = filename.trim();

    if (!isPhoneRecordingComplete) {
      setErrorMessage("Complete the call before saving.");
      setIsSaving(false);
      return;
    }

    if (!cleanedFilename) {
      setErrorMessage("Enter a recording name before saving.");
      setIsSaving(false);
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const seconds = Number(completedRecording.recordingDuration || 0);
    const durationText = `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}`;

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    const user = sessionData?.session?.user;

    if (sessionError || !user) {
      setErrorMessage("You must be logged in before saving.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("call_recordings").insert([
      {
        customer_id: user.id,
        file_name: cleanedFilename,
        duration: durationText,
        full_transcript: phoneTranscription.transcript,
        original_file_name: null,
      },
    ]);

    if (error) {
      console.error("Failed to save phone recording:", error);
      setErrorMessage("Could not save phone recording.");
      setIsSaving(false);
      return;
    }

    setSuccessMessage("Phone recording saved.");
    navigation.goBack();
  }

  async function handleStartPhoneRecording() {
    if (isStartingCallRef.current) {
      return;
    }

    const cleanedPhoneNumber = phoneNumber.trim();

    if (!cleanedPhoneNumber) {
      setErrorMessage("Enter a phone number first.");
      setCallStatus("Missing phone number");
      return;
    }

    setErrorMessage("");
    setCallSession(null);
    isStartingCallRef.current = true;
    setIsStartingCall(true);
    setCallStatus("Starting call...");

    try {
      const customerId = process.env.EXPO_PUBLIC_DEV_CUSTOMER_ID;

      const result = await startPhoneCall({
        phoneNumber: cleanedPhoneNumber,
        customerId,
      });

      console.log("Phone call service result:", result);
      setCallSession(result);
      setCallStatus("Call start requested");

      try {
        PhoneTranscriptionService.initialize();
        PhoneTranscriptionService.startCall();
      } catch (transcriptionError) {
        console.error(
          "Failed to start phone transcription websocket:",
          transcriptionError,
        );
      }
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
        <Text style={styles.statusText}>
          Phone transcript status: {phoneTranscription.callStatus || "Idle"}
        </Text>

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
          {successMessage ? (
            <Text style={styles.successText}>{successMessage}</Text>
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
        {callSession ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Call session</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>
                {getCallSessionStatusLabel(callSession.status)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Session ID</Text>
              <Text style={styles.detailValue}>
                {callSession.callSessionId}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provider ID</Text>
              <Text style={styles.detailValue}>
                {callSession.providerCallId}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone number</Text>
              <Text style={styles.detailValue}>{callSession.phoneNumber}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Started</Text>
              <Text style={styles.detailValue}>
                {formatCallStartedAt(callSession.startedAt)}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live transcript</Text>

          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>
              {phoneTranscription.transcript ||
                "Live transcript will appear here after the call connects."}
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

          {isPhoneRecordingComplete ? (
            <>
              <SessionRow
                label="Recording status"
                value={completedRecording.recordingStatus || "Unknown"}
              />
              <SessionRow
                label="Recording SID"
                value={completedRecording.recordingSid || "Unknown"}
              />
              <SessionRow
                label="Call SID"
                value={completedRecording.callSid || "Unknown"}
              />
              <SessionRow
                label="Duration"
                value={
                  completedRecording.recordingDuration
                    ? `${completedRecording.recordingDuration} seconds`
                    : "Unknown"
                }
              />
              <Pressable
                style={[
                  styles.primaryButton,
                  (!isPhoneRecordingComplete || isSaving) &&
                    styles.primaryButtonDisabled,
                ]}
                onPress={handleSavePhoneRecording}
                disabled={!isPhoneRecordingComplete || isSaving}
              >
                <Text style={styles.primaryButtonText}>
                  {isSaving ? "Saving..." : "Save phone recording"}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.helperText}>
              Complete the call first, then recording details will appear here.
            </Text>
          )}
        </View>

        {!isPhoneRecordingComplete ? (
          <Pressable
            style={[
              styles.primaryButton,
              (isStartingCall || callSession) && styles.primaryButtonDisabled,
            ]}
            onPress={handleStartPhoneRecording}
            disabled={isStartingCall || Boolean(callSession)}
          >
            <Text style={styles.primaryButtonText}>
              {isStartingCall
                ? "Starting..."
                : callSession
                ? "Call started"
                : "Start phone recording"}
            </Text>
          </Pressable>
        ) : null}

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
  sessionRow: {
    marginTop: 10,
  },

  sessionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },

  sessionValue: {
    marginTop: 2,
    fontSize: 14,
    color: "#111827",
  },
  successText: {
    marginTop: 12,
    fontSize: 14,
    color: "#047857",
  },
});
