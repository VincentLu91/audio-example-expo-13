import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { ROUTES } from "../constants/routes";
import HomeScreen from "../screens/HomeScreen";
import MicRecordingScreen from "../screens/MicRecordingScreen";
import PhoneRecordingScreen from "../screens/PhoneRecordingScreen";

const Tab = createBottomTabNavigator();

function getTabIcon(routeName, focused, color, size) {
  let iconName = "ellipse-outline";

  if (routeName === ROUTES.HOME) {
    iconName = focused ? "home" : "home-outline";
  }

  if (routeName === ROUTES.MIC_RECORDING) {
    iconName = focused ? "mic" : "mic-outline";
  }

  if (routeName === ROUTES.PHONE_RECORDING) {
    iconName = focused ? "call" : "call-outline";
  }

  return <Ionicons name={iconName} size={size} color={color} />;
}

export default function BottomTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) =>
          getTabIcon(route.name, focused, color, size),
      })}
    >
      <Tab.Screen
        name={ROUTES.HOME}
        component={HomeScreen}
        options={{ title: "Home" }}
      />

      <Tab.Screen
        name={ROUTES.MIC_RECORDING}
        component={MicRecordingScreen}
        options={{ title: "Mic" }}
      />

      <Tab.Screen
        name={ROUTES.PHONE_RECORDING}
        component={PhoneRecordingScreen}
        options={{ title: "Phone" }}
      />
    </Tab.Navigator>
  );
}
