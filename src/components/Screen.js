import { SafeAreaView } from "react-native-safe-area-context";

export default function Screen({ children }) {
  return (
    <SafeAreaView
      edges={["top", "right", "left"]}
      style={{
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "stretch",
        padding: 16,
        backgroundColor: "#f9fafb",
      }}
    >
      {children}
    </SafeAreaView>
  );
}
