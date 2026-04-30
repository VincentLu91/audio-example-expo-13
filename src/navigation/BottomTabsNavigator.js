import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "../constants/routes";
import HomeScreen from "../screens/HomeScreen";
import MicRecordingScreen from "../screens/MicRecordingScreen";
import PhoneRecordingScreen from "../screens/PhoneRecordingScreen";
import AccountScreen from "../screens/AccountScreen";
import PlayerScreen from "../screens/PlayerScreen";

const Tab = createBottomTabNavigator();

const HomeStack = createNativeStackNavigator();
const HOME_STACK_HOME = "HomeStackHome";

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name={HOME_STACK_HOME} component={HomeScreen} />
      <HomeStack.Screen name={ROUTES.PLAYER} component={PlayerScreen} />
    </HomeStack.Navigator>
  );
}

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

  if (routeName === ROUTES.ACCOUNT) {
    iconName = focused ? "person" : "person-outline";
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
        component={HomeStackNavigator}
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

      <Tab.Screen
        name={ROUTES.ACCOUNT}
        component={AccountScreen}
        options={{ title: "Account" }}
      />
    </Tab.Navigator>
  );
}
