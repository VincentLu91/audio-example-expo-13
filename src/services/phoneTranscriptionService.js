const PHONE_TRANSCRIPTION_WS_URL =
  "wss://call-transcribe-heroku-b15b1132d70f.herokuapp.com";

const listeners = new Set();

let ws = null;
let keepAliveInterval = null;
let currentSessionId = null;

const state = {
  transcript: "",
  callStatus: null,
  callRecordingInfo: null,
  initialized: false,
  sessionId: null,
};

function notify() {
  listeners.forEach((listener) => {
    try {
      listener({ ...state });
    } catch {}
  });
}

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function clearKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

function closeSocket({ sendStop = true } = {}) {
  if (!ws) {
    return;
  }

  try {
    if (sendStop && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          event: "stop",
          sessionId: currentSessionId,
        }),
      );
    }

    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
  } catch (error) {
    console.log("Phone transcription socket close error:", error);
  } finally {
    ws = null;
  }
}

export const PhoneTranscriptionService = {
  initialize() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    state.transcript = "";
    state.callStatus = null;
    state.callRecordingInfo = null;
    state.sessionId = null;
    currentSessionId = null;

    notify();
  },

  startCall({ preserveExistingSession = false } = {}) {
    clearKeepAlive();
    closeSocket({ sendStop: false });

    if (!preserveExistingSession || !currentSessionId) {
      currentSessionId = generateSessionId();
      state.transcript = "";
      state.callRecordingInfo = null;
    }

    state.sessionId = currentSessionId;
    state.callStatus = preserveExistingSession ? "reconnecting" : "connecting";
    notify();

    ws = new WebSocket(PHONE_TRANSCRIPTION_WS_URL);

    ws.onopen = () => {
      console.log("Phone transcription WebSocket connected");

      state.callStatus = "connected";
      notify();

      ws.send(
        JSON.stringify({
          event: "connected",
          sessionId: currentSessionId,
        }),
      );

      this.keepAlive();
    };

    ws.onmessage = (message) => {
      console.log("Phone transcription WebSocket message:", message.data);

      try {
        const data = JSON.parse(message.data);

        if (data.sessionId && data.sessionId !== currentSessionId) {
          console.log("Ignoring stale phone transcription message");
          return;
        }

        if (data.event === "interim-transcription") {
          const nextTranscript = typeof data.text === "string" ? data.text : "";

          if (!nextTranscript.trim()) {
            return;
          }

          state.transcript = nextTranscript;
          notify();
          return;
        }

        if (data.event === "update_recording_status") {
          const result = data.result;

          state.callRecordingInfo = result;
          state.callStatus = result?.recordingStatus || "unknown";

          notify();

          if (result?.recordingStatus === "completed") {
            this.stop();
          }
        }
      } catch (error) {
        console.error("Failed to process phone transcription message:", error);
      }
    };

    ws.onerror = (error) => {
      console.log("Phone transcription WebSocket error:", {
        message: error?.message,
        type: error?.type,
        keys: error ? Object.keys(error) : [],
        raw: error,
        currentStatus: state.callStatus,
      });

      if (state.callStatus === "completed") {
        return;
      }

      state.callStatus = "websocket_error";
      notify();
    };

    ws.onclose = (event) => {
      console.log("Phone transcription WebSocket closed:", {
        code: event?.code,
        reason: event?.reason,
        wasClean: event?.wasClean,
      });

      if (state.callStatus !== "completed") {
        state.callStatus = `websocket_closed_${event?.code || "unknown"}`;
        notify();
      }
    };
  },

  keepAlive() {
    clearKeepAlive();

    keepAliveInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            event: "ping",
            sessionId: currentSessionId,
          }),
        );
      }
    }, 20 * 1000);
  },

  stop() {
    clearKeepAlive();
    closeSocket();

    state.initialized = false;
    state.sessionId = null;
    currentSessionId = null;

    notify();
  },

  reset() {
    clearKeepAlive();
    closeSocket({ sendStop: false });

    state.transcript = "";
    state.callStatus = null;
    state.callRecordingInfo = null;
    state.initialized = false;
    state.sessionId = null;
    currentSessionId = null;

    notify();
  },

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

  isSocketOpen() {
    return ws?.readyState === WebSocket.OPEN;
  },
};
