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
import * as Clipboard from "expo-clipboard";
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
  const [copiedMessageKey, setCopiedMessageKey] = useState(null);
  const copyResetTimeoutRef = useRef(null);

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

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  async function copyMessageToClipboard(message, messageKey) {
    const textToCopy = message?.trim();

    if (!textToCopy) {
      return;
    }

    try {
      await Clipboard.setStringAsync(textToCopy);

      setCopiedMessageKey(messageKey);

      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }

      copyResetTimeoutRef.current = setTimeout(() => {
        setCopiedMessageKey(null);
      }, 1600);
    } catch (error) {
      setErrorMessage("Could not copy message.");
    }
  }

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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                const messageKey = `${item.sender}-${index}`;
                const isCopied = copiedMessageKey === messageKey;

                return (
                  <View
                    key={messageKey}
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.botBubble,
                    ]}
                  >
                    <View style={styles.messageHeaderRow}>
                      <Text style={styles.senderText}>
                        {isUser ? "You" : "AI Agent"}
                      </Text>

                      {!isUser ? (
                        <Pressable
                          onPress={() =>
                            copyMessageToClipboard(item.message, messageKey)
                          }
                          hitSlop={8}
                          style={styles.copyButton}
                        >
                          <Text style={styles.copyButtonText}>
                            {isCopied ? "Copied" : "Copy"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

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
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
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
    backgroundColor: "#202033",
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
    color: "#F8F8FC",
  },

  subtitle: {
    fontSize: 14,
    color: "#C9CAD8",
  },

  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  loadingText: {
    color: "#C9CAD8",
  },

  errorText: {
    color: "#EF4444",
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
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#34364A",
  },

  promptPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F8F8FC",
  },

  messageBubble: {
    maxWidth: "86%",
    borderRadius: 16,
    padding: 12,
  },

  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#3C36D9",
  },

  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#2B2C3F",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },

  senderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#C9CAD8",
  },

  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#F8F8FC",
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
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#F8F8FC",
    backgroundColor: "#2B2C3F",
  },

  sendButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#5C4DFF",
  },

  sendButtonText: {
    color: "#F8F8FC",
    fontSize: 15,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.5,
  },

  messageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },

  copyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#34364A",
  },

  copyButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F8F8FC",
  },
});
