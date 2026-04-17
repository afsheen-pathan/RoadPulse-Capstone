import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

const RegisterScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Citizen');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const handleRegister = async () => {
    if (!name || !email || !password || !role) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSuccess(true);
      } else {
        Alert.alert('Error', data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  const roleOptions = ['Citizen', 'Contractor', 'Ambulance'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar style="light" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* LOGO SECTION */}
        <View style={styles.logoContainer}>
  <Text style={{ fontSize: 24 }}>🚦</Text>
          <Text style={styles.appName}>RoadPulse</Text>
        </View>

        {/* HEADER SECTION */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Smart Emergency Traffic System</Text>
        </View>

        {/* MAIN FORM CARD */}
        <View style={[styles.card, { backgroundColor: '#14171C' }]}>
          
          {/* SELECT IDENTITY (PILL) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SELECT IDENTITY</Text>
          </View>
          <View style={styles.pillContainer}>
            {roleOptions.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setRole(item)}
                style={[
                  styles.pillItem,
                  role === item && styles.pillActive
                ]}
              >
                <Text style={[
                  styles.pillText,
                  role === item && styles.pillTextActive
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* INPUT FIELDS */}
          <View style={styles.formGroup}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person" size={20} color="#A0AEC0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#A0AEC0"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.atIcon}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#A0AEC0"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={20} color="#A0AEC0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#A0AEC0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#A0AEC0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* TERMS CHECKBOX */}
          <View style={styles.termsContainer}>
            <TouchableOpacity 
              style={[styles.checkbox, agree && styles.checkboxActive]} 
              onPress={() => setAgree(!agree)}
            >
              {agree && <Ionicons name="checkmark" size={14} color="#fff" />}
            </TouchableOpacity>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsHighlight}>Terms of Service</Text>
            </Text>
          </View>

          {/* CREATE ACCOUNT BUTTON */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleRegister}>
            <Text style={styles.submitBtnText}>Create Account</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.arrowIcon} />
          </TouchableOpacity>

        </View>

        {/* FOOTER LINK */}
        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerHighlight}>Login</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
      {/* --- SUCCESS MODAL --- */}
      <Modal
        visible={showSuccess}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-done" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Registration Success!</Text>
            <Text style={styles.successSubtitle}>Welcome to RoadPulse. Your account has been created successfully.</Text>
            
            <TouchableOpacity 
              style={styles.successBtn} 
              onPress={() => {
                setShowSuccess(false);
                navigation.navigate('Login');
              }}
            >
              <Text style={styles.successBtnText}>PROCEED TO LOGIN</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    marginTop:20,
  },
  appName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 8,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#1F2329',
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: '#0D0E10',
    borderRadius: 20,
    padding: 5,
    marginBottom: 30,
  },
  pillItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  pillActive: {
    backgroundColor: '#4285F4',
  },
  pillText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0E10',
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 65,
    marginBottom: 15,
  },
  inputIcon: {
    marginRight: 15,
  },
  atIcon: {
    color: '#A0AEC0',
    fontSize: 20,
    marginRight: 15,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    paddingLeft: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#0D0E10',
    borderWidth: 1,
    borderColor: '#1F2329',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  termsText: {
    color: '#A0AEC0',
    fontSize: 13,
  },
  termsHighlight: {
    color: '#4285F4',
    textDecorationLine: 'underline',
  },
  submitBtn: {
    backgroundColor: '#4285F4',
    height: 65,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  arrowIcon: {
    marginLeft: 10,
  },
  footerLink: {
    marginTop: 35,
    alignItems: 'center',
  },
  footerText: {
    marginTop:-20,
    color: '#A0AEC0',
    fontSize: 14,
  },
  footerHighlight: {
    color: '#4285F4',
    fontWeight: '800',
  },
  // --- SUCCESS MODAL STYLES ---
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#1A1D23',
    borderRadius: 36,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  successTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    color: '#A0AEC0',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  successBtn: {
    width: '100%',
    backgroundColor: '#4285F4',
    height: 65,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  successBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
  },
});

export default RegisterScreen;