import { useEffect, useRef, useState } from "react";
import { ExpoPlayAudioStream } from "@mykin-ai/expo-audio-stream";
import { AudioModule } from "expo-audio";
import { Buffer } from "buffer";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { File } from "expo-file-system";
import { decode } from "base64-arraybuffer";
import * as Clipboard from "expo-clipboard";

import Screen from "../components/Screen";
import { supabase } from "../../lib/supabase";
import { stopActivePlayback } from "../services/playbackControlService";
import { MicTranscriptionService } from "../services/micTranscriptionService";
import { theme } from "../theme/theme";

const API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
const SAMPLE_RATE = 16000;

export default function MicRecordingScreen({ navigation }) {
  const [recordingStatus, setRecordingStatus] = useState("idle");
  const [transcriptText, setTranscriptText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [recordingName, setRecordingName] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState(null);
  const [micTokensAvailable, setMicTokensAvailable] = useState(null);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const transcriptCopyTimeoutRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    return MicTranscriptionService.subscribe((nextState) => {
      setRecordingStatus(nextState.recordingStatus);
      setTranscriptText(nextState.transcriptText);
      setErrorMessage(nextState.errorMessage);
      setSaveMessage(nextState.saveMessage);
      setRecordingName(nextState.recordingName);
      setRecordingDuration(nextState.recordingDuration);
      setRecordingUri(nextState.recordingUri);
      if (typeof nextState.micTokensAvailable === "number") {
        setMicTokensAvailable(nextState.micTokensAvailable);
      }
    });
  }, []);

  useEffect(() => {
    async function loadCurrentMicTokens() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        console.error("Failed to get Supabase user for mic tokens:", userError);
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select("id, mic_tokens")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to load current mic tokens:", error);
        return;
      }

      setMicTokensAvailable(data?.mic_tokens ?? 0);
    }

    loadCurrentMicTokens();
  }, []);

  useEffect(() => {
    return () => {
      if (transcriptCopyTimeoutRef.current) {
        clearTimeout(transcriptCopyTimeoutRef.current);
      }
    };
  }, []);

  const audioStreamRef = useRef(null);

  function appendTranscript(text) {
    if (!text) return;

    setTranscriptText((currentText) => {
      if (!currentText || currentText === "Listening...") {
        return text;
      }

      return `${currentText}\n${text}`;
    });
  }

  async function connectSocket() {
    if (!API_KEY) {
      setErrorMessage("Missing EXPO_PUBLIC_ASSEMBLYAI_API_KEY");
      setRecordingStatus("error");
      return null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    try {
      setRecordingStatus("connecting");

      const tokenUrl = new URL("https://streaming.assemblyai.com/v3/token");
      tokenUrl.searchParams.set("expires_in_seconds", "60");
      tokenUrl.searchParams.set("max_session_duration_seconds", "3600");

      const response = await fetch(tokenUrl.toString(), {
        headers: {
          Authorization: API_KEY,
        },
      });

      const data = await response.json();

      if (data.error) {
        setErrorMessage(`Token error: ${data.error}`);
        setRecordingStatus("error");
        return null;
      }

      const params = new URLSearchParams({
        sample_rate: String(SAMPLE_RATE),
        format_turns: "true",
        token: data.token,
        speech_model: "u3-rt-pro",
        speaker_labels: "true",
      });

      const ws = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?${params}`,
      );

      ws.onopen = () => {
        setRecordingStatus("connected");
        setErrorMessage("");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "Begin") return;

          if (data.type === "Turn") {
            const transcript = data.transcript || "";

            if (!transcript) return;

            if (!data.end_of_turn) {
              return;
            }

            const speakerLabel = data.speaker_label;
            const finalText = speakerLabel
              ? `Speaker ${speakerLabel}: ${transcript}`
              : transcript;

            appendTranscript(finalText);
            return;
          }

          if (data.type === "Termination") return;
        } catch {
          // Ignore non-JSON socket messages for now.
        }
      };

      ws.onerror = () => {
        setRecordingStatus("error");
        setErrorMessage("Mic transcription WebSocket error");
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };

      wsRef.current = ws;
      return ws;
    } catch (error) {
      setRecordingStatus("error");
      setErrorMessage(`Connect error: ${String(error)}`);
      return null;
    }
  }

  async function handleStartRecording() {
    await stopActivePlayback();
    await MicTranscriptionService.startRecording();
  }

  async function handleStopRecording() {
    await MicTranscriptionService.stopRecording();
  }

  function formatDurationFromMillis(durationMillis) {
    const totalSeconds = Math.floor(durationMillis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  async function handleSaveRecording() {
    const trimmedName = recordingName.trim();
    const trimmedTranscript = transcriptText.trim();
    const formattedDuration = formatDurationFromMillis(
      recordingDuration * 1000,
    );

    if (
      !trimmedName ||
      !trimmedTranscript ||
      !recordingUri ||
      recordingStatus !== "stopped"
    ) {
      return;
    }

    console.log("Mic recording save payload:", {
      recordingName: trimmedName,
      recordingDuration: formattedDuration,
      recordingStatus,
      recordingDuration,
      recordingUri,
      transcriptText: trimmedTranscript,
    });

    setErrorMessage("");
    setSaveMessage("");
    //setRecordingDuration(0);

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    const user = sessionData?.session?.user;

    if (sessionError || !user) {
      setErrorMessage("You must be logged in before saving.");
      return;
    }

    const storageFileName = `${trimmedName}_${user.id}_${Date.now()}.wav`;

    try {
      // Use the new File class API from expo-file-system v54
      const file = new File(recordingUri);

      // Read the audio file as base64 using the new API
      const base64String = await file.base64();

      // Convert base64 to ArrayBuffer for Supabase upload
      const arrayBuffer = decode(base64String);

      const { error: uploadError } = await supabase.storage
        .from("recreate-ai-storage-bucket")
        .upload(storageFileName, arrayBuffer, {
          contentType: "audio/wav",
        });

      if (uploadError) {
        console.error("Upload failed:", uploadError);
        setErrorMessage("Failed to upload audio file.");
        return;
      }
    } catch (uploadError) {
      console.error("Upload error:", uploadError);
      setErrorMessage(`Failed to upload audio file: ${String(uploadError)}`);
      return;
    }

    const { error } = await supabase.from("mic_recordings").insert([
      {
        customer_id: user.id,
        file_name: trimmedName,
        duration: formattedDuration,
        full_transcript: trimmedTranscript,
        original_file_name: storageFileName,
      },
    ]);

    if (error) {
      console.error("Failed to save mic recording:", error);
      setErrorMessage("Could not save mic recording.");
      return;
    }

    setSaveMessage("Mic recording saved.");

    await MicTranscriptionService.reset();
    navigation.goBack();
  }

  const canSaveRecording =
    recordingStatus === "stopped" &&
    recordingName.trim().length > 0 &&
    transcriptText.trim().length > 0;

  async function copyTranscriptToClipboard() {
    const textToCopy = transcriptText.trim();

    if (!textToCopy) {
      return;
    }

    await Clipboard.setStringAsync(textToCopy);
    setTranscriptCopied(true);

    if (transcriptCopyTimeoutRef.current) {
      clearTimeout(transcriptCopyTimeoutRef.current);
    }

    transcriptCopyTimeoutRef.current = setTimeout(() => {
      setTranscriptCopied(false);
    }, 1600);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Mic Recording</Text>

          <Text style={styles.subtitle}>
            Record from the microphone, transcribe live, then save it to your
            recordings list.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recording status</Text>
            <Text style={styles.statusText}>{recordingStatus}</Text>
            <Text style={styles.statusDetailText}>
              Mic seconds left:{" "}
              {typeof micTokensAvailable === "number"
                ? micTokensAvailable
                : "Loading..."}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Live transcript</Text>

              {transcriptText.trim().length > 0 ? (
                <Pressable
                  onPress={copyTranscriptToClipboard}
                  hitSlop={8}
                  style={styles.copyButton}
                >
                  <Text style={styles.copyButtonText}>
                    {transcriptCopied ? "Copied" : "Copy"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>
                {transcriptText ||
                  "Live transcript will appear here after recording starts."}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recording name</Text>

            <TextInput
              style={styles.input}
              value={recordingName}
              onChangeText={(text) => {
                setRecordingName(text);
                MicTranscriptionService.setRecordingName(text);
              }}
              placeholder="Example: Team meeting notes"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="sentences"
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 250);

                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 650);
              }}
            />
          </View>

          {transcriptText.trim().length > 0 && (
            <Pressable
              style={[
                styles.primaryButton,
                !canSaveRecording && styles.disabledButton,
              ]}
              onPress={handleSaveRecording}
              disabled={!canSaveRecording}
            >
              <Text style={styles.primaryButtonText}>Save recording</Text>
            </Pressable>
          )}

          {!["recording", "connected"].includes(recordingStatus) ? (
            <Pressable
              style={[
                styles.primaryButton,
                recordingStatus === "stopped" && styles.disabledButton,
              ]}
              onPress={handleStartRecording}
              disabled={recordingStatus === "stopped"}
            >
              <Text style={styles.primaryButtonText}>Start mic recording</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.secondaryButton}
              onPress={handleStopRecording}
            >
              <Text style={styles.secondaryButtonText}>Stop mic recording</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryButtonText}>Back to recordings</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  container: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },

  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },

  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },

  statusText: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },

  statusDetailText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  transcriptBox: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.colors.surfaceSoft,
  },

  transcriptText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
  },

  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: theme.colors.surfaceSoft,
    color: theme.colors.textPrimary,
  },

  disabledButton: {
    opacity: 0.5,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  copyButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceSoft,
  },

  copyButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
});
