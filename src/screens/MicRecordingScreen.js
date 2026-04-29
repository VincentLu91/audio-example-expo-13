import { useEffect, useRef, useState } from "react";
import { ExpoPlayAudioStream } from "@mykin-ai/expo-audio-stream";
import { AudioModule } from "expo-audio";
import { Buffer } from "buffer";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Screen from "../components/Screen";
import { supabase } from "../../lib/supabase";

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

  const wsRef = useRef(null);
  const audioStreamRef = useRef(null);
  const isRecordingRef = useRef(false);
  const durationTimerRef = useRef(null);

  const pendingChunksRef = useRef([]);
  const pendingBytesRef = useRef(0);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      isRecordingRef.current = false;

      if (audioStreamRef.current) {
        ExpoPlayAudioStream.stopRecording();
        audioStreamRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

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

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;

      if (audioStreamRef.current) {
        audioStreamRef.current.stop();
        audioStreamRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  async function handleStartRecording() {
    console.log("Start mic recording pressed");

    if (isRecordingRef.current) {
      console.log("Mic recording already running");
      return;
    }

    isRecordingRef.current = true;

    let ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ws = await connectSocket();
    }

    if (!ws) {
      return;
    }

    console.log("Socket open, starting mic stream");
    const permission = await AudioModule.requestRecordingPermissionsAsync();

    console.log("Expo audio permission:", permission);

    if (!permission.granted) {
      setRecordingStatus("permission denied");
      setErrorMessage("Microphone permission was not granted.");
      isRecordingRef.current = false;
      return;
    }

    setErrorMessage("");
    setSaveMessage("");
    setRecordingDuration(0);
    setTranscriptText("Listening...");
    setRecordingStatus("recording");
    durationTimerRef.current = setInterval(() => {
      setRecordingDuration((currentDuration) => currentDuration + 1);
    }, 1000);

    pendingChunksRef.current = [];
    pendingBytesRef.current = 0;

    try {
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: SAMPLE_RATE,
        channels: 1,
        encoding: "pcm_16bit",
        interval: 250,
        onAudioStream: (event) => {
          const currentWs = wsRef.current;

          if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
            return;
          }

          const binary = Buffer.from(event.data, "base64");

          pendingChunksRef.current.push(binary);
          pendingBytesRef.current += binary.length;

          if (pendingBytesRef.current >= 3200) {
            const merged = Buffer.concat(pendingChunksRef.current);
            const arrayBuffer = merged.buffer.slice(
              merged.byteOffset,
              merged.byteOffset + merged.byteLength,
            );

            currentWs.send(arrayBuffer);

            pendingChunksRef.current = [];
            pendingBytesRef.current = 0;
          }
        },
      });

      subscriptionRef.current = subscription;
      console.log("Mic stream started");
    } catch (error) {
      setRecordingStatus("error");
      setErrorMessage(`Start recording error: ${String(error)}`);
      console.log("Start recording error:", error);
      isRecordingRef.current = false;
    }
  }

  async function handleStopRecording() {
    console.log("Stopping mic recording");

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    isRecordingRef.current = false;

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    try {
      await ExpoPlayAudioStream.stopRecording();
    } catch (error) {
      console.log("Stop recording error:", error);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    pendingChunksRef.current = [];
    pendingBytesRef.current = 0;

    setRecordingStatus("stopped");

    console.log("Mic recording stopped");
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

    if (!trimmedName || !trimmedTranscript || recordingStatus !== "stopped") {
      return;
    }

    console.log("Mic recording save payload:", {
      recordingName: trimmedName,
      recordingDuration: formattedDuration,
      recordingStatus,
      recordingDuration,
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

    const { error } = await supabase.from("mic_recordings").insert([
      {
        customer_id: user.id,
        file_name: trimmedName,
        duration: formattedDuration,
        full_transcript: trimmedTranscript,
        original_file_name: trimmedName,
      },
    ]);

    if (error) {
      console.error("Failed to save mic recording:", error);
      setErrorMessage("Could not save mic recording.");
      return;
    }

    setSaveMessage("Mic recording saved.");
  }

  const canSaveRecording =
    recordingStatus === "stopped" &&
    recordingName.trim().length > 0 &&
    transcriptText.trim().length > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Mic Recording</Text>

        <Text style={styles.subtitle}>
          Record from the microphone, transcribe live, then save it to your
          recordings list.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recording status</Text>
          <Text style={styles.statusText}>{recordingStatus}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live transcript</Text>
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
              setSaveMessage("");
            }}
            placeholder="Example: Team meeting notes"
            autoCapitalize="sentences"
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

        {!isRecordingRef.current ? (
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
  statusText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
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
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#f9fafb",
    color: "#111827",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
