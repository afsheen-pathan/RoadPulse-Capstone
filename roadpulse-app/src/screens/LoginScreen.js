import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // ✅ AUTO LOGIN FIX
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const savedRole = await AsyncStorage.getItem('role');

        if (token && savedRole) {
          const role = savedRole.toLowerCase(); // ✅ FIX

          if (role === "citizen") {
            navigation.replace("Citizen");
          } else if (role === "contractor") {
            navigation.replace("Contractor");
          } else if (role === "ambulance") {
            navigation.replace("Ambulance");
          }
        }
      } catch (err) {
        console.log("Session error:", err);
      }
    };

    checkExistingSession();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const role = data.user.role.toLowerCase(); // ✅ FIX

        // ✅ SAVE EVERYTHING
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('role', role);
        await AsyncStorage.setItem('email', data.user.email); // 🔥 NEW

        // ✅ NAVIGATION FIX
        if (role === 'citizen') {
          navigation.replace('Citizen');
        } else if (role === 'contractor') {
          navigation.replace('Contractor');
        } else if (role === 'ambulance') {
          navigation.replace('Ambulance');
        } else {
          Alert.alert('Error', 'Invalid role');
        }

      } else {
        Alert.alert('Error', data.message || 'Login failed');
      }

    } catch (error) {
      console.error('Login Error:', error);
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>

        <View style={styles.logoContainer}>
    <Text style={styles.logo}>🚦</Text>
    <Text style={styles.appName}>RoadPulse</Text>
  </View>

  <View style={styles.header}>
    <Text style={styles.title}>Welcome Back</Text>
    <Text style={styles.subtitle}>
      Smart Emergency Traffic System
    </Text>
        </View>

        <View style={styles.card}>

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              Don't have an account? Register
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: '#0a0a0a',
},

content: {
  flex: 1,
  justifyContent: 'center',
  padding: 20,
},

logoContainer: {
  alignItems: 'center',
  marginBottom: 30,
},

logo: {
  fontSize: 50,
},

appName: {
  color: '#fff',
  fontSize: 26,
  fontWeight: 'bold',
  marginTop: 5,
},

header: {
  marginBottom: 30,
  alignItems: 'center',
},

title: {
  color: '#fff',
  fontSize: 28,
  fontWeight: 'bold',
},

subtitle: {
  color: '#888',
  fontSize: 14,
  marginTop: 5,
  textAlign: 'center',
},

card: {
  backgroundColor: '#1c1c1e',
  padding: 20,
  borderRadius: 15,
  borderWidth: 1,
  borderColor: '#2c2c2e',
},

input: {
  backgroundColor: '#2c2c2e',
  color: '#fff',
  padding: 15,
  borderRadius: 12,
  marginBottom: 15,
  fontSize: 16,
  borderWidth: 1,
  borderColor: '#3a3a3c',
},
  button: {
  backgroundColor: '#FF3B30',
  padding: 15,
  borderRadius: 12,
  alignItems: 'center',
  marginTop: 10,
},
  buttonText: {
  color: '#fff',
  fontSize: 18,
  fontWeight: 'bold',
},

link: {
  marginTop: 20,
  alignItems: 'center',
},

linkText: {
  color: '#FF3B30',
  fontSize: 15,
},
});

export default LoginScreen;