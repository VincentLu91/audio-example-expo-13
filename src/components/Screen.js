import { SafeAreaView } from "react-native-safe-area-context";

export default function Screen({ children }) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
      }}
    >
      {children}
    </SafeAreaView>
  );
}
