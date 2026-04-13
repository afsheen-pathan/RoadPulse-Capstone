import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Import Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CitizenMap from './src/screens/CitizenMap';
import ContractorMap from './src/screens/ContractorMap';
import AmbulanceMap from './src/screens/AmbulanceMap';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {/* Auth Screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

        {/* Dashboard Screens */}
        <Stack.Screen name="CitizenMap" component={CitizenMap} />
        <Stack.Screen name="ContractorMap" component={ContractorMap} />
        <Stack.Screen name="AmbulanceMap" component={AmbulanceMap} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}