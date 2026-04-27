import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "../constants/routes";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import DetailsScreen from "../screens/DetailsScreen";
import LiveTranscriptionScreen from "../screens/LiveTranscriptionScreen";
import PlayerScreen from "../screens/PlayerScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={ROUTES.LOGIN}>
        <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
        <Stack.Screen name={ROUTES.HOME} component={HomeScreen} />
        <Stack.Screen name={ROUTES.DETAILS} component={DetailsScreen} />
        <Stack.Screen
          name={ROUTES.LIVE_TRANSCRIPTION}
          component={LiveTranscriptionScreen}
        />
        <Stack.Screen name={ROUTES.PLAYER} component={PlayerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
