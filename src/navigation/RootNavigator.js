import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "../constants/routes";
import HomeScreen from "../screens/HomeScreen";
import DetailsScreen from "../screens/DetailsScreen";
import LiveTranscriptionScreen from "../screens/LiveTranscriptionScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={ROUTES.HOME}>
        <Stack.Screen
          name={ROUTES.HOME}
          component={HomeScreen}
          options={{ title: "Home" }}
        />

        <Stack.Screen
          name={ROUTES.LIVE_TRANSCRIPTION}
          component={LiveTranscriptionScreen}
          options={{ title: "Live Transcription" }}
        />

        <Stack.Screen
          name={ROUTES.DETAILS}
          component={DetailsScreen}
          options={{ title: "Details" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
