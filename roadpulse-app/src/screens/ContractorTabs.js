import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ContractorMap from './ContractorMap';
import ProfileScreen from './ProfileScreen';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

export default function ContractorTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: '#000',
              tabBarInactiveTintColor: theme.subText,
              tabBarStyle: { 
                backgroundColor: theme.background, 
                borderTopWidth: 0,
                elevation: 0,
                height: 55,
                paddingBottom: 10,
                paddingTop: 5,
              },
              tabBarShowLabel: false,
      
              tabBarIcon: ({ focused, color, size }) => {
                const icon =
                  route.name === 'Map'
                    ? (focused ? 'map' : 'map-outline')
                    : (focused ? 'person' : 'person-outline');
      
                return (
                  <View style={[
                    styles.tabItem, 
                    focused && { backgroundColor: theme.primary }
                  ]}>
                    <Ionicons name={icon} size={24} color={focused ? '#000' : theme.subText} />
                    <Text style={[
                      styles.tabLabel, 
                      { color: focused ? '#000' : theme.subText }
                    ]}>
                      {route.name.toUpperCase()}
                    </Text>
                  </View>
                );
              },
            })}
    >
      <Tab.Screen name="Map" component={ContractorMap} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 25,
    borderRadius: 20,
    width: 100,
    height: 50,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  }
});