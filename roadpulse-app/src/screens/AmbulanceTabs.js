import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AmbulanceMap from './AmbulanceMap';
import ProfileScreen from './ProfileScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function AmbulanceTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#00FF00',
        tabBarStyle: { backgroundColor: '#1c1c1e' },

        tabBarIcon: ({ color, size }) => {
          const icon =
            route.name === 'Map'
              ? 'medkit-outline'
              : 'person-outline';

          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={AmbulanceMap} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}