import { SafeAreaView } from "react-native";

export default function Screen({ children }) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "stretch",
        padding: 16,
      }}
    >
      {children}
    </SafeAreaView>
  );
}
