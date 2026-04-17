import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  border,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

const CustomInput = ({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, theme }) => (
  <View style={[styles.inputContainer, { backgroundColor: '#1A1D23', borderColor: theme.border }]}>
    <Ionicons name={icon} size={20} color={theme.subText} style={styles.inputIcon} />
    <TextInput
      style={[styles.input, { color: theme.text }]}
      placeholder={placeholder}
      placeholderTextColor={theme.subText}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
    />
  </View>
);
const LoginScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // ✅ AUTO LOGIN FIX
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const savedRole = await AsyncStorage.getItem('userRole');

        if (token && savedRole) {
          const role = savedRole.toLowerCase();

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
        const role = data.user.role.toLowerCase();

        // ✅ SAVE EVERYTHING
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('userRole', role);
        await AsyncStorage.setItem('email', data.user.email);
        await AsyncStorage.setItem('userName', data.user.name);
        if (data.user.profilePicture) {
          await AsyncStorage.setItem('profilePic', data.user.profilePicture);
        }

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

  // ✅ MOVE THIS OUTSIDE

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />
      
      <ScrollView 
  contentContainerStyle={styles.scrollContent} 
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>
        
        {/* LOGO HEADER */}
        <View style={styles.logoHeader}>
  <Text style={{ fontSize: 24 }}>🚦</Text>
          <Text style={styles.appName}>RoadPulse</Text>
        </View>

        {/* WELCOME SECTION */}
        <View style={styles.welcomeSection}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>SMART EMERGENCY TRAFFIC SYSTEM</Text>
        </View>

        {/* LOGIN CARD */}
        <View style={[styles.card, { backgroundColor: '#14171C' }]}>
          <CustomInput
  icon="mail"
  placeholder="Email Address"
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  autoCapitalize="none"
  theme={theme}
/>
          <CustomInput
  icon="lock-closed"
  placeholder="Password"
  value={password}
  onChangeText={setPassword}
  secureTextEntry={true}
  theme={theme}
/>
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* REGISTER LINK */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            Don't have an account? <Text style={styles.registerHighlight}>Register</Text>
          </Text>
        </TouchableOpacity>

        {/* SYSTEM STATUS CARD */}
        {/* <View style={styles.statusCard}>
          <View style={styles.statusIconContainer}>
            <Ionicons name="information-circle" size={24} color="#B0D1FF" />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>System Status: Active</Text>
            <Text style={styles.statusSubtitle}>
              RoadPulse is currently monitoring traffic patterns across 14 major sectors to optimize emergency response times.
            </Text>
          </View>
        </View> */}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  appName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  card: {
    padding: 25,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#1A1D23',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  inputIcon: {
    marginRight: 12,
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  loginBtn: {
    backgroundColor: '#4285F4',
    height: 65,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  registerLink: {
    marginTop: 40,
    alignItems: 'center',
    marginBottom: 60,
  },
  registerText: {
    color: '#A0AEC0',
    fontSize: 15,
  },
  registerHighlight: {
    color: '#B0D1FF',
    fontWeight: '800',
  },
  statusCard: {
    backgroundColor: '#14171C',
    flexDirection: 'row',
    padding: 20,
    borderRadius: 25,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#1A1D23',
  },
  statusIconContainer: {
    marginRight: 15,
    marginTop: 2,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusSubtitle: {
    color: '#A0AEC0',
    fontSize: 11,
    lineHeight: 16,
  },
});

export default LoginScreen;