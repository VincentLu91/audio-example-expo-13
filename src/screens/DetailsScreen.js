import { Button, Text } from "react-native";
import Screen from "../components/Screen";

export default function DetailsScreen({ navigation }) {
  return (
    <Screen>
      <Text>Details Screen</Text>
      <Button title="Go back" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
