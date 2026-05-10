import { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { askRecordingAgent } from "../services/chatAgentService";
import { theme } from "../theme/theme";

export default function LiveAskBox({ transcriptText, recordingType = "mic" }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const copyTimeoutRef = useRef(null);

  const cleanedTranscript = transcriptText?.trim() || "";
  const cleanedQuestion = question.trim();

  const canAsk =
    cleanedTranscript.length > 0 && cleanedQuestion.length > 0 && !isAsking;

  async function handleAskLive() {
    if (!cleanedTranscript) {
      setErrorMessage("Start recording first so there is transcript context.");
      return;
    }

    if (!cleanedQuestion) {
      setErrorMessage("Type a question first.");
      return;
    }

    setIsAsking(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        setErrorMessage("You must be logged in to use Ask Live.");
        return;
      }

      const response = await askRecordingAgent({
        message: cleanedQuestion,
        transcriptText: cleanedTranscript,
        soundUrl: `live-${recordingType}-recording`,
        userId: user.id,
        recordingId: `live-${recordingType}-recording`,
        recordingType,
        persistMessages: false,
      });

      setAnswer(response);
    } catch (error) {
      console.error("Ask Live error:", error);
      setErrorMessage("Ask Live could not get an answer.");
    } finally {
      setIsAsking(false);
    }
  }

  async function copyAnswerToClipboard() {
    const textToCopy = answer.trim();

    if (!textToCopy) {
      return;
    }

    await Clipboard.setStringAsync(textToCopy);
    setCopiedAnswer(true);

    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }

    copyTimeoutRef.current = setTimeout(() => {
      setCopiedAnswer(false);
    }, 1600);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Ask Live</Text>

      <Text style={styles.helperText}>
        Ask a question about what has been said so far.
      </Text>

      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="Example: What did they just decide?"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="sentences"
        returnKeyType="send"
        onSubmitEditing={handleAskLive}
        editable={!isAsking}
      />

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={[
          styles.primaryButton,
          !canAsk ? styles.primaryButtonDisabled : null,
        ]}
        onPress={handleAskLive}
        disabled={!canAsk}
      >
        {isAsking ? (
          <ActivityIndicator color={theme.colors.textPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>Ask Live</Text>
        )}
      </Pressable>

      {answer ? (
        <View style={styles.answerBox}>
          <View style={styles.answerHeaderRow}>
            <Text style={styles.answerLabel}>Answer</Text>

            <Pressable
              onPress={copyAnswerToClipboard}
              hitSlop={8}
              style={styles.copyButton}
            >
              <Text style={styles.copyButtonText}>
                {copiedAnswer ? "Copied" : "Copy"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.answerText}>{answer}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  helperText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
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
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.danger,
    fontWeight: "600",
  },
  answerBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.colors.surfaceSoft,
    gap: 8,
  },
  answerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  answerLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  answerText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  copyButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
});
