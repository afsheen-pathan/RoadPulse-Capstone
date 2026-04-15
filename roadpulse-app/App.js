import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/context/ThemeContext';

// Import Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CitizenTabs from './src/screens/CitizenTabs';
import ContractorTabs from './src/screens/ContractorTabs';
import AmbulanceTabs from './src/screens/AmbulanceTabs';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
  <ThemeProvider>
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

        <Stack.Screen name="Citizen" component={CitizenTabs} />
        <Stack.Screen name="Contractor" component={ContractorTabs} />
        <Stack.Screen name="Ambulance" component={AmbulanceTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  </ThemeProvider>
);
}