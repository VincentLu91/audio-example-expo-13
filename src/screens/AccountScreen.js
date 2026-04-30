import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import Screen from "../components/Screen";
import { supabase } from "../../lib/supabase";

export default function AccountScreen() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    setSigningOut(false);

    if (error) {
      Alert.alert("Sign out failed", error.message);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Account</Text>

        <Text style={styles.description}>
          Manage billing, subscription, and account settings on the website.
        </Text>

        <Pressable
          style={[styles.button, signingOut && styles.buttonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text style={styles.buttonText}>
            {signingOut ? "Signing out..." : "Sign out"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: "#4b5563",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
