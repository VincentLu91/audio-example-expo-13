import { StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { theme } from "../theme/theme";

const TAB_BAR_HEIGHT = 76;
const TAB_BAR_BOTTOM_GAP = 12;
const TAB_BAR_CONTENT_GAP = 16;

export default function Screen({ children, contentStyle }) {
  const insets = useSafeAreaInsets();

  const bottomPadding =
    Math.max(insets.bottom, TAB_BAR_BOTTOM_GAP) +
    TAB_BAR_HEIGHT +
    TAB_BAR_CONTENT_GAP;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View
        style={[styles.content, { paddingBottom: bottomPadding }, contentStyle]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  content: {
    flex: 1,
    width: "100%",
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
});
