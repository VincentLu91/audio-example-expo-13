import { AudioModule } from "expo-audio";
import { ExpoPlayAudioStream } from "@mykin-ai/expo-audio-stream";
import { Buffer } from "buffer";

import { supabase } from "../../lib/supabase";

const API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
const SAMPLE_RATE = 16000;

const listeners = new Set();

let ws = null;
let subscription = null;
let durationTimer = null;
let isRecording = false;
let pendingChunks = [];
let pendingBytes = 0;
let micTokenCustomerId = null;
let recordingStartedAtMs = null;
let micTokensAtStart = null;

const state = {
  recordingStatus: "idle",
  transcriptText: "",
  errorMessage: "",
  saveMessage: "",
  recordingName: "",
  recordingDuration: 0,
  recordingUri: null,
  isRecording: false,
  micTokensAvailable: null,
};

function notify() {
  listeners.forEach((listener) => {
    try {
      listener({ ...state });
    } catch {}
  });
}

function updateState(partialState) {
  Object.assign(state, partialState);
  notify();
}

function appendTranscript(text) {
  if (!text) return;

  const currentText = state.transcriptText;

  updateState({
    transcriptText:
      !currentText || currentText === "Listening..."
        ? text
        : `${currentText}\n${text}`,
  });
}

async function connectSocket() {
  if (!API_KEY) {
    updateState({
      recordingStatus: "error",
      errorMessage: "Missing EXPO_PUBLIC_ASSEMBLYAI_API_KEY",
    });

    return null;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    return ws;
  }

  try {
    updateState({
      recordingStatus: "connecting",
      errorMessage: "",
    });

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
      updateState({
        recordingStatus: "error",
        errorMessage: `Token error: ${data.error}`,
      });

      return null;
    }

    const params = new URLSearchParams({
      sample_rate: String(SAMPLE_RATE),
      format_turns: "true",
      token: data.token,
      speech_model: "u3-rt-pro",
      speaker_labels: "true",
    });

    ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params}`);

    ws.onopen = () => {
      updateState({
        recordingStatus: "connected",
        errorMessage: "",
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "Begin") return;

        if (data.type === "Turn") {
          const transcript = data.transcript || "";

          if (!transcript || !data.end_of_turn) return;

          const finalText = data.speaker_label
            ? `Speaker ${data.speaker_label}: ${transcript}`
            : transcript;

          appendTranscript(finalText);
        }
      } catch {
        // Ignore non-JSON socket messages for now.
      }
    };

    ws.onerror = () => {
      updateState({
        recordingStatus: "error",
        errorMessage: "Mic transcription WebSocket error",
      });
    };

    ws.onclose = () => {
      ws = null;
    };

    return ws;
  } catch (error) {
    updateState({
      recordingStatus: "error",
      errorMessage: `Connect error: ${String(error)}`,
    });

    return null;
  }
}

function clearDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

async function loadMicTokens() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return null;
  }

  micTokenCustomerId = user.id;

  const { data, error } = await supabase
    .from("customers")
    .select("id, mic_tokens")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to load mic tokens:", error);
    return null;
  }

  const tokens = data?.mic_tokens ?? 0;
  updateState({ micTokensAvailable: tokens });
  return tokens;
}

export const MicTranscriptionService = {
  subscribe(listener) {
    listeners.add(listener);

    try {
      listener({ ...state });
    } catch {}

    return () => {
      listeners.delete(listener);
    };
  },

  getState() {
    return { ...state };
  },

  setRecordingName(recordingName) {
    updateState({
      recordingName,
      saveMessage: "",
    });
  },

  setSaveMessage(saveMessage) {
    updateState({ saveMessage });
  },

  setErrorMessage(errorMessage) {
    updateState({ errorMessage });
  },

  async startRecording() {
    console.log("Start mic recording pressed");

    if (isRecording) {
      console.log("Mic recording already running");
      return;
    }

    isRecording = true;

    updateState({
      isRecording: true,
    });

    let currentWs = ws;

    if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
      currentWs = await connectSocket();
    }

    if (!currentWs) {
      isRecording = false;

      updateState({
        isRecording: false,
      });

      return;
    }

    console.log("Socket open, starting mic stream");

    const permission = await AudioModule.requestRecordingPermissionsAsync();

    console.log("Expo audio permission:", permission);

    if (!permission.granted) {
      isRecording = false;

      updateState({
        recordingStatus: "permission denied",
        errorMessage: "Microphone permission was not granted.",
        isRecording: false,
      });

      return;
    }

    const currentMicTokens = await loadMicTokens();

    if (currentMicTokens !== null && currentMicTokens <= 0) {
      isRecording = false;
      updateState({
        recordingStatus: "error",
        errorMessage: "No mic recording seconds available.",
        isRecording: false,
      });
      return;
    }

    recordingStartedAtMs = Date.now();
    micTokensAtStart = currentMicTokens;

    pendingChunks = [];
    pendingBytes = 0;

    updateState({
      errorMessage: "",
      saveMessage: "",
      recordingDuration: 0,
      recordingUri: null,
      transcriptText: "Listening...",
      recordingStatus: "recording",
      isRecording: true,
    });

    clearDurationTimer();

    durationTimer = setInterval(async () => {
      if (!recordingStartedAtMs || typeof micTokensAtStart !== "number") {
        return;
      }

      const elapsedSeconds = Math.floor(
        (Date.now() - recordingStartedAtMs) / 1000,
      );

      const nextTokens = Math.max(0, micTokensAtStart - elapsedSeconds);

      updateState({
        recordingDuration: elapsedSeconds,
        micTokensAvailable: nextTokens,
      });

      if (micTokenCustomerId) {
        const { error } = await supabase
          .from("customers")
          .update({ mic_tokens: nextTokens })
          .eq("id", micTokenCustomerId);

        if (error) {
          console.error("Failed to update mic tokens:", error);
        }
      }

      if (nextTokens === 0) {
        await MicTranscriptionService.stopRecording();
      }
    }, 1000);

    try {
      const result = await ExpoPlayAudioStream.startRecording({
        sampleRate: SAMPLE_RATE,
        channels: 1,
        encoding: "pcm_16bit",
        interval: 250,

        onAudioStream: (event) => {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
          }

          const binary = Buffer.from(event.data, "base64");

          pendingChunks.push(binary);
          pendingBytes += binary.length;

          if (pendingBytes >= 3200) {
            const merged = Buffer.concat(pendingChunks);

            const arrayBuffer = merged.buffer.slice(
              merged.byteOffset,
              merged.byteOffset + merged.byteLength,
            );

            ws.send(arrayBuffer);

            pendingChunks = [];
            pendingBytes = 0;
          }
        },
      });

      subscription = result.subscription;

      console.log("Mic stream started");
    } catch (error) {
      isRecording = false;
      clearDurationTimer();

      updateState({
        recordingStatus: "error",
        errorMessage: `Start recording error: ${String(error)}`,
        isRecording: false,
      });

      console.log("Start recording error:", error);
    }
  },

  async stopRecording() {
    console.log("Stopping mic recording");

    clearDurationTimer();

    isRecording = false;

    updateState({
      isRecording: false,
    });

    if (subscription) {
      subscription.remove();
      subscription = null;
    }

    try {
      const recording = await ExpoPlayAudioStream.stopRecording();

      console.log("Mic stop recording result:", recording);

      if (recording?.fileUri) {
        updateState({
          recordingUri: recording.fileUri,
        });

        console.log("Mic recording file URI:", recording.fileUri);
      }
    } catch (error) {
      console.log("Stop recording error:", error);
    }

    if (ws) {
      ws.close();
      ws = null;
    }

    pendingChunks = [];
    pendingBytes = 0;

    updateState({
      recordingStatus: "stopped",
      isRecording: false,
    });

    console.log("Mic recording stopped");
  },

  async reset() {
    clearDurationTimer();

    isRecording = false;
    micTokenCustomerId = null;
    recordingStartedAtMs = null;
    micTokensAtStart = null;

    if (subscription) {
      subscription.remove();
      subscription = null;
    }

    try {
      await ExpoPlayAudioStream.stopRecording();
    } catch {}

    if (ws) {
      ws.close();
      ws = null;
    }

    pendingChunks = [];
    pendingBytes = 0;

    updateState({
      recordingStatus: "idle",
      transcriptText: "",
      errorMessage: "",
      saveMessage: "",
      recordingName: "",
      recordingDuration: 0,
      recordingUri: null,
      micTokensAvailable: null,
      isRecording: false,
    });
  },
};
