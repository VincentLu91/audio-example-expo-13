import { Button, Text } from "react-native";
import Screen from "../components/Screen";
import { ROUTES } from "../constants/routes";

export default function HomeScreen({ navigation }) {
  return (
    <Screen>
      <Text>Home Screen</Text>
      <Button
        title="Go to details"
        onPress={() => navigation.navigate(ROUTES.DETAILS)}
      />
      <Button
        title="Live Transcription"
        onPress={() => navigation.navigate(ROUTES.LIVE_TRANSCRIPTION)}
      />
      <Button
        title="Player"
        onPress={() => navigation.navigate(ROUTES.PLAYER)}
      />
    </Screen>
  );
}
