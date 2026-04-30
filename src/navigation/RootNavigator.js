import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "../constants/routes";
import LoginScreen from "../screens/LoginScreen";
import DetailsScreen from "../screens/DetailsScreen";
import LiveTranscriptionScreen from "../screens/LiveTranscriptionScreen";
import PlayerScreen from "../screens/PlayerScreen";
import BottomTabsNavigator from "./BottomTabsNavigator";
import { supabase } from "../../lib/supabase";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen
              name={ROUTES.MAIN_TABS}
              component={BottomTabsNavigator}
            />

            <Stack.Screen name={ROUTES.DETAILS} component={DetailsScreen} />

            <Stack.Screen
              name={ROUTES.LIVE_TRANSCRIPTION}
              component={LiveTranscriptionScreen}
            />

            <Stack.Screen name={ROUTES.PLAYER} component={PlayerScreen} />
          </>
        ) : (
          <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
