import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { ExpoPlayAudioStream } from "@mykin-ai/expo-audio-stream";
import { Buffer } from "buffer";

const API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
const SAMPLE_RATE = 16000;

export default function LiveTranscriptionScreen() {
  const wsRef = useRef(null);
  const subscriptionRef = useRef(null);
  const pendingChunksRef = useRef([]);
  const pendingBytesRef = useRef(0);

  const [socketStatus, setSocketStatus] = useState("closed");
  const [micStatus, setMicStatus] = useState("stopped");
  const [lastMessage, setLastMessage] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");
  const [chunksSent, setChunksSent] = useState(0);
  const [turns, setTurns] = useState({});
  const [interim, setInterim] = useState("");

  const connectSocket = async () => {
    if (!API_KEY) {
      setLastMessage("Missing EXPO_PUBLIC_ASSEMBLYAI_API_KEY");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setLastMessage("Socket already open");
      return;
    }

    try {
      // Fetch temporary token from AssemblyAI
      setLastMessage("Fetching token...");
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
        setLastMessage(`Token error: ${data.error}`);
        return;
      }

      const { token } = data;

      // Create WebSocket connection with token in URL params
      const params = new URLSearchParams({
        sample_rate: String(SAMPLE_RATE),
        format_turns: "true",
        token,
        speech_model: "u3-rt-pro",
        speaker_labels: "true",
      });

      const ws = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?${params}`,
      );

      ws.onopen = () => {
        setSocketStatus("open");
        setLastMessage("Socket connected");
        setLiveTranscript("");
        setFullTranscript("");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(JSON.stringify(data));

          if (data.type === "Begin") return;

          if (data.type === "Turn") {
            const transcript = data.transcript || "";
            const formatted = data.turn_is_formatted;
            const speakerLabel = data.speaker_label; // Extract speaker label (e.g., "A", "B", "C")

            // Show live partial for current utterance
            if (!data.end_of_turn) {
              setInterim(transcript);
              return;
            }

            // Commit on endpoint; prefer formatted if present
            const order = Number(data.turn_order ?? 0);

            setTurns((prev) => {
              const next = { ...prev };
              const curr = next[order];
              // upgrade/insert: if we don't have it yet, or we now have a formatted one
              if (!curr || (formatted && !curr.formatted)) {
                next[order] = {
                  text: transcript,
                  formatted,
                  speaker: speakerLabel,
                };
              }
              // rebuild the display string from ordered turns with speaker labels
              const joined = Object.keys(next)
                .map((k) => Number(k))
                .sort((a, b) => a - b)
                .map((k) => {
                  const turn = next[k];
                  // Only add speaker label if speaker info exists
                  return turn.speaker
                    ? `Speaker ${turn.speaker}: ${turn.text}`
                    : turn.text;
                })
                .join("\n\n")
                .trim();
              setLiveTranscript(joined);
              return next;
            });
            setInterim("");
            return;
          }

          if (data.type === "Termination") return;
        } catch {
          setLastMessage(String(event.data));
        }
      };

      ws.onerror = (event) => {
        setSocketStatus("error");
        setLastMessage(`Socket error: ${JSON.stringify(event)}`);
      };

      ws.onclose = () => {
        setSocketStatus("closed");
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (error) {
      setLastMessage(`Connect error: ${String(error)}`);
      setSocketStatus("error");
    }
  };

  const disconnectSocket = () => {
    const ws = wsRef.current;
    if (!ws) return;

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Terminate" }));
      }
      ws.close();
    } catch (e) {
      setLastMessage(`Disconnect error: ${String(e)}`);
    }
  };

  const startRecording = async () => {
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLastMessage("Open the socket first");
      return;
    }

    try {
      // Reset state for new recording
      setChunksSent(0);
      setLiveTranscript("");
      setFullTranscript("");
      setTurns({});
      setInterim("");
      setMicStatus("recording");

      pendingChunksRef.current = [];
      pendingBytesRef.current = 0;
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: SAMPLE_RATE,
        channels: 1,
        encoding: "pcm_16bit",
        interval: 250,
        onAudioStream: (event) => {
          try {
            const currentWs = wsRef.current;
            if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;

            const binary = Buffer.from(event.data, "base64");

            pendingChunksRef.current.push(binary);
            pendingBytesRef.current += binary.length;

            // 16kHz * 16-bit mono = 32000 bytes/sec
            // 100 ms ~= 3200 bytes
            if (pendingBytesRef.current >= 3200) {
              const merged = Buffer.concat(pendingChunksRef.current);
              const arrayBuffer = merged.buffer.slice(
                merged.byteOffset,
                merged.byteOffset + merged.byteLength,
              );

              currentWs.send(arrayBuffer);
              setChunksSent((n) => n + 1);

              pendingChunksRef.current = [];
              pendingBytesRef.current = 0;
            }
          } catch (e) {
            setLastMessage(`Send chunk error: ${String(e)}`);
          }
        },
      });

      subscriptionRef.current = subscription;
    } catch (e) {
      setMicStatus("stopped");
      setLastMessage(`Start recording error: ${String(e)}`);
    }
  };

  const stopRecording = async () => {
    try {
      const currentWs = wsRef.current;

      if (
        currentWs &&
        currentWs.readyState === WebSocket.OPEN &&
        pendingBytesRef.current > 0
      ) {
        const merged = Buffer.concat(pendingChunksRef.current);
        const arrayBuffer = merged.buffer.slice(
          merged.byteOffset,
          merged.byteOffset + merged.byteLength,
        );

        currentWs.send(arrayBuffer);

        pendingChunksRef.current = [];
        pendingBytesRef.current = 0;
      }

      await ExpoPlayAudioStream.stopRecording();
      subscriptionRef.current?.remove?.();
      subscriptionRef.current = null;
      setMicStatus("stopped");
    } catch (e) {
      setLastMessage(`Stop recording error: ${String(e)}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AssemblyAI live mic test</Text>

      <Text>Socket: {socketStatus}</Text>
      <Text>Mic: {micStatus}</Text>
      <Text>Chunks sent: {chunksSent}</Text>

      <Text style={styles.label}>Transcript:</Text>
      <Text style={styles.box}>{fullTranscript || "(nothing final yet)"}</Text>

      <Text style={styles.label}>Live:</Text>
      <Text style={styles.box}>
        {liveTranscript}
        {liveTranscript && interim && " "}
        {interim && <Text style={styles.interim}>{interim}</Text>}
        {!liveTranscript && !interim && "(listening...)"}
      </Text>

      <Text style={styles.label}>Last message:</Text>
      <Text style={styles.box}>{lastMessage || "(none yet)"}</Text>

      <Pressable style={styles.button} onPress={connectSocket}>
        <Text style={styles.buttonText}>CONNECT</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={disconnectSocket}>
        <Text style={styles.buttonText}>DISCONNECT</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={startRecording}>
        <Text style={styles.buttonText}>START RECORDING</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={stopRecording}>
        <Text style={styles.buttonText}>STOP RECORDING</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    marginBottom: 16,
    textAlign: "center",
  },
  label: {
    marginTop: 12,
    fontWeight: "600",
  },
  box: {
    marginTop: 6,
    marginBottom: 8,
  },
  interim: {
    opacity: 0.55,
  },
  button: {
    marginTop: 12,
    backgroundColor: "#2f80ed",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
  },
});
