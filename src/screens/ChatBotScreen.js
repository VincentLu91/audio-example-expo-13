import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import {
  askRecordingAgent,
  fetchChatHistory,
  getRecordingSoundUrl,
  saveChatMessage,
} from "../services/chatAgentService";

const STARTER_PROMPTS = [
  "Summarize this recording",
  "What are the action items?",
  "What was the last important thing said?",
];

export default function ChatBotScreen({ route }) {
  const recording = route?.params?.recording;

  const scrollViewRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const soundUrl = useMemo(() => {
    return getRecordingSoundUrl(recording);
  }, [recording]);

  const transcriptText = recording?.full_transcript || "";

  useEffect(() => {
    async function loadUserAndHistory() {
      setLoadingHistory(true);
      setErrorMessage("");

      const { data, error } = await supabase.auth.getSession();
      const user = data?.session?.user;

      if (error || !user) {
        setErrorMessage("Could not load signed-in user.");
        setLoadingHistory(false);
        return;
      }

      setCurrentUser(user);

      if (!soundUrl) {
        setErrorMessage("This recording does not have an audio URL yet.");
        setLoadingHistory(false);
        return;
      }

      const history = await fetchChatHistory(user.id, soundUrl);
      setMessages(history);
      setLoadingHistory(false);
    }

    loadUserAndHistory();
  }, [soundUrl]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function sendMessage(messageText = userInput) {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage || sending || !currentUser || !soundUrl) {
      return;
    }

    setSending(true);
    setErrorMessage("");

    const userMessage = {
      message: trimmedMessage,
      sender: "User",
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setUserInput("");

    await saveChatMessage({
      message: trimmedMessage,
      sender: "User",
      userId: currentUser.id,
      soundUrl,
    });

    const botResponse = await askRecordingAgent({
      message: trimmedMessage,
      transcriptText,
      existingMessages: messages,
      soundUrl,
    });

    const botMessage = {
      message: botResponse,
      sender: "ChatGPT",
    };

    setMessages((currentMessages) => [...currentMessages, botMessage]);

    await saveChatMessage({
      message: botResponse,
      sender: "ChatGPT",
      userId: currentUser.id,
      soundUrl,
    });

    setSending(false);
  }

  return (
    <SafeAreaView
      edges={["top", "right", "bottom", "left"]}
      style={styles.screen}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Chat about this recording</Text>
          <Text style={styles.subtitle}>
            {recording?.file_name ||
              recording?.original_file_name ||
              "Untitled recording"}
          </Text>
        </View>

        {loadingHistory ? (
          <View style={styles.centerContent}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading chat...</Text>
          </View>
        ) : (
          <>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
            >
              {messages.length === 0 ? (
                <View style={styles.promptContainer}>
                  {STARTER_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt}
                      style={styles.promptPill}
                      onPress={() => setUserInput(prompt)}
                    >
                      <Text style={styles.promptPillText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {messages.map((item, index) => {
                const isUser = item.sender === "User";

                return (
                  <View
                    key={`${item.sender}-${index}`}
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.botBubble,
                    ]}
                  >
                    <Text style={styles.senderText}>
                      {isUser ? "You" : "AI Agent"}
                    </Text>
                    <Text style={styles.messageText}>{item.message}</Text>
                  </View>
                );
              })}

              {sending ? (
                <View style={[styles.messageBubble, styles.botBubble]}>
                  <Text style={styles.senderText}>AI Agent</Text>
                  <Text style={styles.messageText}>Thinking...</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={userInput}
                onChangeText={setUserInput}
                placeholder="Ask about this recording..."
                multiline
              />

              <Pressable
                style={[
                  styles.sendButton,
                  (!userInput.trim() || sending) && styles.disabledButton,
                ]}
                onPress={() => sendMessage()}
                disabled={!userInput.trim() || sending}
              >
                <Text style={styles.sendButtonText}>
                  {sending ? "..." : "Send"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f9fafb",
  },
  container: {
    flex: 1,
    width: "100%",
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#6b7280",
  },
  errorText: {
    color: "red",
    marginBottom: 12,
  },
  messagesScroll: {
    flex: 1,
    width: "100%",
  },
  messagesContent: {
    paddingBottom: 16,
    gap: 12,
  },
  promptContainer: {
    gap: 10,
    paddingVertical: 20,
  },
  promptPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "white",
  },
  promptPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#dbeafe",
  },
  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  senderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#111827",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "white",
  },
  sendButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#2563eb",
  },
  sendButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
