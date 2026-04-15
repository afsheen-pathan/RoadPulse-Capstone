import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CitizenMap from './CitizenMap';
import ProfileScreen from './ProfileScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function CitizenTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#FF3B30',
        tabBarStyle: { backgroundColor: '#1c1c1e' },

        tabBarIcon: ({ color, size }) => {
          const icon =
            route.name === 'Map'
              ? 'map-outline'
              : 'person-outline';

          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={CitizenMap} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}