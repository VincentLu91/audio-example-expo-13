import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ROUTES } from "../constants/routes";
import HomeScreen from "../screens/HomeScreen";
import MicRecordingScreen from "../screens/MicRecordingScreen";
import PhoneRecordingScreen from "../screens/PhoneRecordingScreen";
import AccountScreen from "../screens/AccountScreen";
import PlayerScreen from "../screens/PlayerScreen";
import { theme } from "../theme/theme";

const Tab = createBottomTabNavigator();

const HomeStack = createNativeStackNavigator();
const HOME_STACK_HOME = "HomeStackHome";

function TabBarBackground() {
  return (
    <View pointerEvents="none" style={styles.tabBarBackgroundRoot}>
      <View style={styles.tabBarScrim} />
      <View style={styles.tabBarBackground} />
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.purpleSoft,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: [styles.tabBar, { bottom: Math.max(insets.bottom, 12) }],
        tabBarBackground: () => <TabBarBackground />,
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

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 76,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderTopColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
    shadowColor: "transparent",
  },
  tabBarBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    overflow: "hidden",
  },
  tabBarBackgroundRoot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  tabBarScrim: {
    position: "absolute",
    left: -16,
    right: -16,
    top: 0,
    bottom: -48,
    backgroundColor: "rgba(32, 32, 51, 0.72)",
  },
});
