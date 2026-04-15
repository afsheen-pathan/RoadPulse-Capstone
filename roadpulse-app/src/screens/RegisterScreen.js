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
} from 'react-native';

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Citizen');

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
        Alert.alert('Success', 'Registration successful! Please login.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  const roles = ['Citizen', 'Contractor', 'Ambulance'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
  <Text style={styles.logo}>🚦</Text>
  <Text style={styles.appName}>RoadPulse</Text>
</View>

<View style={styles.header}>
  <Text style={styles.title}>Create Account</Text>
  <Text style={styles.subtitle}>
    Smart Emergency Traffic System
  </Text>
</View>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
          />

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

          <Text style={styles.label}>Select Your Role</Text>
          <View style={styles.roleContainer}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.roleButton,
                  role === r && styles.roleButtonActive,
                ]}
                onPress={() => setRole(r)}
              >
                <Text
                  style={[
                    styles.roleText,
                    role === r && styles.roleTextActive,
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 5,
  },
  form: {
    width: '100%',
  },
  logoContainer: {
    // flexDirection: 'row',
    // justifyContent:'center',
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
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
    marginTop: 10,
  },
  roleContainer: {
    flexDirection: 'column', // Changed from 'row' to stack them
    marginBottom: 25,
  },
  roleButton: {
  width: '100%',
  padding: 15,
  borderRadius: 12,
  alignItems: 'center',
  marginBottom: 10,
  backgroundColor: '#2c2c2e',
  borderWidth: 1,
  borderColor: '#3a3a3c',
},
  roleButtonActive: {
  backgroundColor: '#FF3B30',
  borderColor: '#FF3B30',
},
  roleText: {
  color: '#aaa',
  fontWeight: '600',
},

roleTextActive: {
  color: '#fff',
  fontWeight: 'bold',
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

export default RegisterScreen;
