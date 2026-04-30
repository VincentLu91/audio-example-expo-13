import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Screen({ children, contentStyle }) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
    width: "100%",
    paddingTop: 16,
    paddingHorizontal: 16,
  },
});
