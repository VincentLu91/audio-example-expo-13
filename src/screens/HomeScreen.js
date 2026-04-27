import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Screen from "../components/Screen";
import { ROUTES } from "../constants/routes";
import { supabase } from "../../lib/supabase";

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

export default function HomeScreen({ navigation }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadRecordings();
  }, []);

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

  function renderRecording({ item }) {
    const title =
      item.original_file_name || item.file_name || "Untitled recording";

    const transcriptReady = hasTranscript(item);

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

      {loading ? (
        <ActivityIndicator />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : recordings.length === 0 ? (
        <Text>No recordings found.</Text>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => `${item.recordingType}-${item.id}`}
          renderItem={renderRecording}
          contentContainerStyle={styles.list}
        />
      )}
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
    gap: 12,
    paddingBottom: 24,
  },
  card: {
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
});
