import { supabase } from "../../lib/supabase";

const DEFAULT_AGENT_BASE_URL =
  "https://b2c-agent-v1-staging-a8eed207afac.herokuapp.com";

function getAgentBaseUrl() {
  const baseUrl =
    process.env.EXPO_PUBLIC_AGENT_BASE_URL || DEFAULT_AGENT_BASE_URL;

  return baseUrl.replace(/\/$/, "");
}

export function getRecordingSoundUrl(recording) {
  if (!recording?.original_file_name) {
    return null;
  }

  return supabase.storage
    .from("recreate-ai-storage-bucket")
    .getPublicUrl(recording.original_file_name).data.publicUrl;
}

export async function fetchChatHistory(userId, soundUrl) {
  if (!userId || !soundUrl) {
    return [];
  }

  const { data, error } = await supabase
    .from("chat_history")
    .select("*")
    .eq("user_id", userId)
    .eq("soundUrl", soundUrl)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching chat history:", error.message);
    return [];
  }

  return (data || []).map((message) => ({
    message: message.message,
    sender:
      message.sender === "assistant"
        ? "ChatGPT"
        : message.sender === "user"
        ? "User"
        : message.sender,
  }));
}

export async function saveChatMessage({ message, sender, userId, soundUrl }) {
  if (!message || !sender || !userId || !soundUrl) {
    return;
  }

  const { error } = await supabase.from("chat_history").insert([
    {
      user_id: userId,
      message,
      sender,
      soundUrl,
    },
  ]);

  if (error) {
    console.error("Error saving message:", error.message);
  }
}

export async function askRecordingAgent({
  message,
  transcriptText,
  soundUrl,
  userId,
  recordingId,
  recordingType = "mic",
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const payload = {
      recording_id: String(recordingId || soundUrl || "unknown-recording"),
      recording_type: recordingType === "call" ? "call" : "mic",
      sound_url: soundUrl,
      user_id: userId,
      user_message: message,
      transcript_context: transcriptText || "",
      platform: "expo",
    };

    const response = await fetch(`${getAgentBaseUrl()}/v1/agent/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok || data?.status !== "ok") {
      console.error("Agent v1 response error:", data);
      return "Sorry—I'm having trouble reaching the AI agent right now. Please try again.";
    }

    return data?.assistant_message || "(No response from agent)";
  } catch (error) {
    console.error("Agent v1 error:", error?.message || error);
    return "Sorry—I'm having trouble reaching the AI agent right now. Please try again.";
  } finally {
    clearTimeout(timeoutId);
  }
}

function safeParseRecapJson(agentText) {
  const cleanedText = String(agentText || "")
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    return {
      summary: cleanedText,
      key_points: [],
      action_items: [],
      important_moments: [],
      follow_up: [],
    };
  }
}

export async function generateSavedRecap({
  recording,
  transcriptText,
  soundUrl,
  userId,
}) {
  const trimmedTranscript = transcriptText?.trim();

  if (!recording?.id) {
    throw new Error("Missing recording id.");
  }

  if (!trimmedTranscript) {
    throw new Error("Transcript is empty.");
  }

  if (!soundUrl) {
    throw new Error("Missing sound URL.");
  }

  if (!userId) {
    throw new Error("Missing user id.");
  }

  const recordingType = recording?.recordingType === "call" ? "call" : "mic";
  const tableName =
    recordingType === "call" ? "call_recordings" : "mic_recordings";

  const recapPrompt = `
Create a saved recap for this recording transcript.

Return ONLY valid JSON. No markdown. No code fence. No extra explanation.

Use this exact shape:
{
  "summary": "Short plain-English summary of the recording.",
  "key_points": ["Important point 1", "Important point 2"],
  "action_items": ["Action item 1", "Action item 2"],
  "important_moments": ["Moment 1", "Moment 2"],
  "follow_up": ["Follow-up 1", "Follow-up 2"]
}

Keep it useful, concise, and grounded only in the transcript.
`;

  const agentText = await askRecordingAgent({
    message: recapPrompt,
    transcriptText: trimmedTranscript,
    soundUrl,
    userId,
    recordingId: recording.id,
    recordingType,
  });

  if (!agentText || agentText.startsWith("Sorry—")) {
    throw new Error("Could not generate recap.");
  }

  const recap = safeParseRecapJson(agentText);

  const { error } = await supabase
    .from(tableName)
    .update({ recap })
    .eq("id", recording.id)
    .eq("customer_id", userId);

  if (error) {
    console.error("Error saving recap:", error.message);
    throw new Error("Could not save recap.");
  }

  return recap;
}
