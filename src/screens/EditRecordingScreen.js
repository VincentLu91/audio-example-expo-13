import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Screen from "../components/Screen";
import { ROUTES } from "../constants/routes";
import { theme } from "../theme/theme";
import { supabase } from "../../lib/supabase";

function getTableName(recordingType) {
  return recordingType === "call" ? "call_recordings" : "mic_recordings";
}

export default function EditRecordingScreen({ route, navigation }) {
  const recording = route?.params?.recording;

  const [fileName, setFileName] = useState(recording?.file_name || "");
  const [transcript, setTranscript] = useState(
    recording?.full_transcript || "",
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const originalFileName = recording?.file_name || "";
  const originalTranscript = recording?.full_transcript || "";

  const hasChanges =
    fileName.trim() !== originalFileName.trim() ||
    transcript !== originalTranscript;

  async function saveChanges() {
    if (!recording || saving) {
      return;
    }

    const trimmedFileName = fileName.trim();

    if (!trimmedFileName) {
      setErrorMessage("Filename cannot be empty.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    const user = sessionData?.session?.user;

    if (sessionError || !user) {
      setSaving(false);
      setErrorMessage("Could not confirm signed-in user.");
      return;
    }

    const tableName = getTableName(recording.recordingType);

    const { data, error } = await supabase
      .from(tableName)
      .update({
        file_name: trimmedFileName,
        full_transcript: transcript,
      })
      .eq("id", recording.id)
      .eq("customer_id", user.id)
      .select(
        "id, customer_id, file_name, duration, full_transcript, original_file_name, created_at",
      )
      .single();

    if (error) {
      console.error("Update recording error:", error);
      setSaving(false);
      setErrorMessage("Could not update recording.");
      return;
    }

    const updatedRecording = {
      ...recording,
      ...data,
      recordingType: recording.recordingType,
    };

    setSaving(false);

    Alert.alert("Saved", "Recording updated.");

    navigation.popTo(ROUTES.PLAYER, {
      recording: updatedRecording,
    });
  }

  if (!recording) {
    return (
      <Screen>
        <View style={styles.emptyState}>
          <Text style={styles.title}>Edit Recording</Text>
          <Text style={styles.errorText}>No recording selected.</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Edit Recording</Text>
            <Text style={styles.subtitle}>
              Update the filename or clean up the transcript.
            </Text>
          </View>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Filename</Text>
            <TextInput
              value={fileName}
              onChangeText={setFileName}
              placeholder="Enter filename"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.fileNameInput}
              maxLength={80}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Transcript</Text>
            <TextInput
              value={transcript}
              onChangeText={setTranscript}
              placeholder="Enter transcript"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.transcriptInput}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.goBack()}
              disabled={saving}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.saveButton,
                (!hasChanges || saving) && styles.disabledButton,
              ]}
              onPress={saveChanges}
              disabled={!hasChanges || saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    width: "100%",
  },
  scroll: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    gap: 6,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  card: {
    width: "100%",
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },
  fileNameInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceSoft,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  transcriptInput: {
    minHeight: 280,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceSoft,
    color: theme.colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    backgroundColor: theme.colors.surface,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: "800",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
    backgroundColor: theme.colors.purpleSoft,
  },
  saveButtonText: {
    color: theme.colors.background,
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    width: "100%",
    gap: theme.spacing.md,
    justifyContent: "center",
  },
});
