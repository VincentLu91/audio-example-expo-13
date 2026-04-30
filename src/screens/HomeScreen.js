import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Slider from "@react-native-community/slider";
import Ionicons from "@expo/vector-icons/Ionicons";

import Screen from "../components/Screen";
import { ROUTES } from "../constants/routes";
import { supabase } from "../../lib/supabase";
import {
  stopActivePlayback,
  subscribeToPlaybackState,
  toggleActivePlayback,
  seekActivePlayback,
} from "../services/playbackControlService";

function formatDuration(duration) {
  if (duration === null || duration === undefined || duration === "") {
    return "Unknown duration";
  }

  // Handles Postgres/Supabase interval-style strings like:
  // "00:01:23", "01:23", or "00:01:23.456"
  if (typeof duration === "string" && duration.includes(":")) {
    const parts = duration.split(":").map((part) => Number(part));

    if (parts.some((part) => Number.isNaN(part))) {
      return "Unknown duration";
    }

    let totalSeconds = 0;

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      totalSeconds = hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      const [minutes, seconds] = parts;
      totalSeconds = minutes * 60 + seconds;
    }

    const roundedSeconds = Math.round(totalSeconds);
    const minutes = Math.floor(roundedSeconds / 60);
    const seconds = roundedSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  // Handles numbers or numeric strings.
  let totalSeconds = Number(duration);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "Unknown duration";
  }

  // If the value looks like milliseconds, convert to seconds.
  // Example: 93000 => 1:33
  if (totalSeconds > 10000) {
    totalSeconds = totalSeconds / 1000;
  }

  const roundedSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCreatedAt(createdAt) {
  if (!createdAt) {
    return "Unknown date";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRecordingTypeLabel(recordingType) {
  if (recordingType === "call") {
    return "Phone call";
  }

  return "Mic recording";
}

function hasTranscript(recording) {
  return Boolean(recording?.full_transcript?.trim());
}

function formatMiniPlayerTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function HomeScreen({ navigation }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [deletingRecordingKey, setDeletingRecordingKey] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [playbackState, setPlaybackState] = useState({
    activeRecording: null,
    isPlaying: false,
  });

  useEffect(() => {
    return subscribeToPlaybackState(setPlaybackState);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecordings();
    }, []),
  );

  async function loadRecordings() {
    setLoading(true);
    setErrorMessage("");

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    const user = sessionData?.session?.user;

    if (sessionError || !user) {
      navigation.replace(ROUTES.LOGIN);
      return;
    }

    const { data: micRecordings, error: micError } = await supabase
      .from("mic_recordings")
      .select(
        "id, customer_id, file_name, duration, full_transcript, original_file_name, created_at",
      )
      .eq("customer_id", user.id);

    if (micError) {
      console.error("Mic recordings error:", micError);
      setErrorMessage("Could not load mic recordings.");
      setLoading(false);
      return;
    }

    const { data: callRecordings, error: callError } = await supabase
      .from("call_recordings")
      .select(
        "id, customer_id, file_name, duration, full_transcript, original_file_name, created_at",
      )
      .eq("customer_id", user.id);

    if (callError) {
      console.error("Call recordings error:", callError);
      setErrorMessage("Could not load call recordings.");
      setLoading(false);
      return;
    }

    const combinedRecordings = [
      ...(micRecordings || []).map((item) => ({
        ...item,
        recordingType: "mic",
      })),
      ...(callRecordings || []).map((item) => ({
        ...item,
        recordingType: "call",
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setRecordings(combinedRecordings);
    setLoading(false);
  }

  function getRecordingKey(recording) {
    return `${recording.recordingType}-${recording.id}`;
  }

  function confirmDeleteRecording(recording) {
    const title =
      recording.file_name || recording.original_file_name || "this recording";

    Alert.alert(
      "Delete recording?",
      `Delete "${title}"? This will remove it from your recordings list.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteRecording(recording),
        },
      ],
    );
  }

  async function deleteRecording(recording) {
    const recordingKey = getRecordingKey(recording);
    const tableName =
      recording.recordingType === "call" ? "call_recordings" : "mic_recordings";

    setDeletingRecordingKey(recordingKey);
    setErrorMessage("");

    try {
      await stopActivePlayback();
    } catch (playbackError) {
      console.warn("Stop playback before delete warning:", playbackError);
    }

    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq("id", recording.id)
      .eq("customer_id", recording.customer_id);

    if (deleteError) {
      console.error("Delete recording error:", deleteError);
      setErrorMessage("Could not delete recording.");
      setDeletingRecordingKey(null);
      return;
    }

    if (recording.original_file_name) {
      const { error: storageError } = await supabase.storage
        .from("recreate-ai-storage-bucket")
        .remove([recording.original_file_name]);

      if (storageError) {
        console.warn("Storage delete warning:", storageError);
      }
    }

    setRecordings((currentRecordings) =>
      currentRecordings.filter(
        (item) => getRecordingKey(item) !== recordingKey,
      ),
    );

    setDeletingRecordingKey(null);
  }

  const normalizedSearchText = searchText.trim().toLowerCase();

  const filteredRecordings = normalizedSearchText
    ? recordings.filter((recording) => {
        const searchableText = [
          recording.file_name,
          recording.original_file_name,
          recording.full_transcript,
          recording.recordingType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearchText);
      })
    : recordings;

  function renderRecording({ item }) {
    const title =
      item.file_name || item.original_file_name || "Untitled recording";
    const transcriptReady = hasTranscript(item);
    const recordingKey = getRecordingKey(item);
    const isDeleting = deletingRecordingKey === recordingKey;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate(ROUTES.PLAYER, {
            recording: item,
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.recordingTitle} numberOfLines={2}>
            {title}
          </Text>

          <Text style={styles.recordingDate}>
            {formatCreatedAt(item.created_at)}
          </Text>

          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {getRecordingTypeLabel(item.recordingType)}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.recordingMeta}>
            {formatDuration(item.duration)}
          </Text>

          <Text
            style={[
              styles.transcriptStatus,
              transcriptReady
                ? styles.transcriptReady
                : styles.transcriptMissing,
            ]}
          >
            {transcriptReady ? "Transcript ready" : "No transcript yet"}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <Pressable
            style={[styles.deleteButton, isDeleting && styles.disabledButton]}
            disabled={isDeleting}
            onPress={(event) => {
              event.stopPropagation();
              confirmDeleteRecording(item);
            }}
          >
            <Text style={styles.deleteButtonText}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Your Recordings</Text>

        <Pressable onPress={loadRecordings}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search recordings or transcripts"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <ActivityIndicator />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : recordings.length === 0 ? (
        <Text>No recordings found.</Text>
      ) : filteredRecordings.length === 0 ? (
        <Text>No recordings match your search.</Text>
      ) : (
        <FlatList
          data={filteredRecordings}
          keyExtractor={(item) => `${item.recordingType}-${item.id}`}
          renderItem={renderRecording}
          contentContainerStyle={styles.list}
        />
      )}
      {playbackState.activeRecording ? (
        <View style={styles.miniPlayer}>
          <View style={styles.miniPlayerTextBlock}>
            <Text style={styles.miniPlayerLabel}>
              {playbackState.isPlaying ? "Now playing" : "Paused"}
            </Text>

            <Text style={styles.miniPlayerTitle} numberOfLines={1}>
              {playbackState.activeRecording.file_name ||
                playbackState.activeRecording.original_file_name ||
                "Untitled recording"}
            </Text>
            <Slider
              style={styles.miniPlayerSlider}
              minimumValue={0}
              maximumValue={playbackState.duration || 0}
              value={playbackState.currentTime || 0}
              disabled={!playbackState.duration}
              onSlidingComplete={seekActivePlayback}
              minimumTrackTintColor="#2563eb"
              maximumTrackTintColor="#d1d5db"
              thumbTintColor="#2563eb"
            />
            <View style={styles.miniPlayerTimeRow}>
              <Text style={styles.miniPlayerTimeText}>
                {formatMiniPlayerTime(playbackState.currentTime)}
              </Text>

              <Text style={styles.miniPlayerTimeText}>
                {formatMiniPlayerTime(playbackState.duration)}
              </Text>
            </View>
          </View>

          <View style={styles.miniPlayerActions}>
            <Pressable
              style={styles.miniPlayerIconButton}
              onPress={toggleActivePlayback}
            >
              <Ionicons
                name={playbackState.isPlaying ? "pause" : "play"}
                size={22}
                color="white"
              />
            </Pressable>

            <Pressable
              style={styles.miniPlayerButton}
              onPress={() =>
                navigation.navigate(ROUTES.PLAYER, {
                  recording: playbackState.activeRecording,
                })
              }
            >
              <Text style={styles.miniPlayerButtonText}>Open</Text>
            </Pressable>

            <Pressable
              style={styles.miniPlayerStopIconButton}
              onPress={stopActivePlayback}
            >
              <Ionicons name="stop" size={20} color="#374151" />
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  refreshText: {
    fontSize: 16,
    fontWeight: "600",
  },
  list: {
    width: "100%",
    alignSelf: "stretch",
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    width: "100%",
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    backgroundColor: "white",
  },

  cardHeader: {
    marginBottom: 12,
  },

  cardTitleBlock: {
    flex: 1,
  },

  recordingTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  recordingDate: {
    fontSize: 13,
    color: "#666",
  },

  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    marginTop: 8,
  },

  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  recordingMeta: {
    fontSize: 14,
    color: "#444",
  },

  transcriptStatus: {
    fontSize: 13,
    fontWeight: "600",
  },

  transcriptReady: {
    color: "#047857",
  },

  transcriptMissing: {
    color: "#9ca3af",
  },
  errorText: {
    color: "red",
  },

  searchInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "white",
  },
  cardActions: {
    marginTop: 14,
    alignItems: "flex-end",
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
  },
  deleteButtonText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  miniPlayer: {
    width: "100%",
    padding: 12,
    marginBottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  miniPlayerTextBlock: {
    flex: 1,
  },

  miniPlayerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 2,
  },

  miniPlayerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  miniPlayerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  miniPlayerButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#111827",
  },

  miniPlayerButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },

  miniPlayerStopButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },

  miniPlayerStopButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  miniPlayerSlider: {
    width: "100%",
    height: 32,
    marginTop: 4,
  },
  miniPlayerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  miniPlayerStopIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  miniPlayerTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  miniPlayerTimeText: {
    fontSize: 11,
    color: "#6b7280",
  },
});
