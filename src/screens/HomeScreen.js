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
    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate(ROUTES.PLAYER, {
            recording: item,
          })
        }
      >
        <Text style={styles.recordingTitle}>
          {item.file_name || "Untitled recording"}
        </Text>

        <Text style={styles.recordingMeta}>Type: {item.recordingType}</Text>

        <Text style={styles.recordingMeta}>
          Created:{" "}
          {item.created_at
            ? new Date(item.created_at).toLocaleDateString()
            : "Unknown date"}
        </Text>
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
    borderRadius: 12,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  recordingMeta: {
    fontSize: 14,
    marginBottom: 4,
  },
  errorText: {
    color: "red",
  },
});
