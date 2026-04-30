import { supabase } from "../../lib/supabase";

const DEFAULT_AGENT_BASE_URL = "https://next-supabase-login-email-a.vercel.app";

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

export function splitTranscriptIntoDocuments(transcriptText, chunkSize = 30) {
  const trimmedTranscript = transcriptText?.trim();

  if (!trimmedTranscript) {
    return [];
  }

  const words = trimmedTranscript.split(/\s+/);
  const chunks = [];
  let currentChunk = [];

  for (const word of words) {
    if (currentChunk.length < chunkSize) {
      currentChunk.push(word);
    } else {
      chunks.push(currentChunk.join(" "));
      currentChunk = [word];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks.map((chunk, index) => ({
    title: String(index + 1),
    snippet: chunk,
  }));
}

export function mapMessagesToAgentHistory(messages) {
  return messages.map((message) => ({
    role: message.sender === "User" ? "user" : "assistant",
    content: message.message,
  }));
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
    sender: message.sender,
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
  existingMessages,
  soundUrl,
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const apiMessages = mapMessagesToAgentHistory(existingMessages || []);

    const payload = {
      query: message,
      documents: splitTranscriptIntoDocuments(transcriptText || "", 30),
      chat_history: apiMessages,
      messages: apiMessages,
      metadata: {
        soundUrl,
      },
    };

    const response = await fetch(`${getAgentBaseUrl()}/api/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Agent response error:", data);
      return "Sorry—I'm having trouble reaching the AI agent right now. Please try again.";
    }

    return (
      data?.text ||
      data?.answer ||
      data?.output ||
      data?.reply ||
      "(No response from agent)"
    );
  } catch (error) {
    console.error("Agent error:", error?.message || error);

    return "Sorry—I'm having trouble reaching the AI agent right now. Please try again.";
  } finally {
    clearTimeout(timeoutId);
  }
}
