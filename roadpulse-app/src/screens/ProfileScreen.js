import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  Switch,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ProfileScreen({ navigation }) {
  const { theme, isDark, toggleTheme } = useTheme();
  
  // User Data State
  const [userName, setUserName] = useState("Alexander Pierce");
  const [email, setEmail] = useState("alex.p@roadpulse.com");
  const [role, setRole] = useState("CITIZEN");
  const [profilePic, setProfilePic] = useState('https://i.pravatar.cc/300?img=68');
  const [token, setToken] = useState(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [passModalVisible, setPassModalVisible] = useState(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const storedEmail = await AsyncStorage.getItem("email");
      const storedRole = await AsyncStorage.getItem("userRole");
      const storedName = await AsyncStorage.getItem("userName");
      const storedPic = await AsyncStorage.getItem("profilePic");
      const storedToken = await AsyncStorage.getItem("token");

      if (storedEmail) setEmail(storedEmail);
      if (storedRole) setRole(storedRole.toUpperCase());
      if (storedName) setUserName(storedName);
      if (storedPic) setProfilePic(storedPic);
      if (storedToken) setToken(storedToken);

      // If name isn't stored but email is, use email prefix
      if (!storedName && storedEmail) {
        let name = storedEmail.split('@')[0];
        name = name.charAt(0).toUpperCase() + name.slice(1);
        setUserName(name);
      }
    };
    loadUser();
  }, []);

  const logout = async () => {
    await AsyncStorage.clear();
    navigation.replace("Login");
  };

  // --- FUNCTIONALITY ---

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to change your profile picture.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfilePic(base64Image);
      
      // Update Backend
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ profilePicture: base64Image })
        });

        if (response.ok) {
          await AsyncStorage.setItem("profilePic", base64Image);
          Alert.alert("Success", "Profile picture updated!");
        } else {
          Alert.alert("Error", "Failed to update profile picture on server.");
        }
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Network error updating profile picture.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleChangeName = async () => {
    if (!newName.trim()) {
      Alert.alert("Error", "Please enter a valid name.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });

      if (response.ok) {
        setUserName(newName);
        await AsyncStorage.setItem("userName", newName);
        setNameModalVisible(false);
        setNewName("");
        Alert.alert("Success", "Name updated successfully!");
      } else {
        const data = await response.json();
        Alert.alert("Error", data.message || "Failed to update name.");
      }
    } catch (err) {
      Alert.alert("Error", "Network error updating name.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.ok) {
        setPassModalVisible(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        Alert.alert("Success", "Password updated successfully!");
      } else {
        const data = await response.json();
        Alert.alert("Error", data.message || "Failed to update password.");
      }
    } catch (err) {
      Alert.alert("Error", "Network error updating password.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI COMPONENTS ---

  const SettingItem = ({ icon, label, onPress, showChevron = true, children }) => (
    <TouchableOpacity 
      style={[styles.settingItem, { borderBottomColor: theme.border }]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
          <Ionicons name={icon} size={20} color={theme.text} />
        </View>
        <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {children}
        {showChevron && <Ionicons name="chevron-forward" size={18} color={theme.subText} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* PROFILE SECTION */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarGlow, { shadowColor: theme.primary }]} />
            <Image 
              source={{ uri: profilePic }} 
              style={styles.avatar} 
            />
            {loading && (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color={theme.primary} />
              </View>
            )}
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{userName}</Text>
          <Text style={[styles.email, { color: theme.subText }]}>{email}</Text>
          
          <View style={[styles.badge, { backgroundColor: theme.card }]}>
            <Text style={[styles.badgeText, { color: theme.subText }]}>{role}</Text>
          </View>
        </View>

        {/* ACCOUNT SETTINGS */}
        <Text style={[styles.sectionHeader, { color: theme.subText }]}>ACCOUNT SETTINGS</Text>
        <View style={[styles.settingsCard, { backgroundColor: theme.card }]}>
          <SettingItem 
            icon="person-circle-outline" 
            label="Change Profile Picture" 
            onPress={handlePickImage} 
          />
          <SettingItem 
            icon="pencil-outline" 
            label="Change Name" 
            onPress={() => setNameModalVisible(true)} 
          />
          <SettingItem 
            icon="lock-closed-outline" 
            label="Change Password" 
            onPress={() => setPassModalVisible(true)} 
            showChevron={true} 
          />
        </View>

        {/* APP SETTINGS */}
        <Text style={[styles.sectionHeader, { color: theme.subText }]}>APP SETTINGS</Text>
        <View style={[styles.settingsCard, { backgroundColor: theme.card }]}>
          <SettingItem 
  icon={isDark ? "moon-outline" : "sunny-outline"} 
  label="Theme Toggle" 
  showChevron={false}
>
  <View style={styles.themeToggleContainer}>
    <Text style={[styles.themeToggleSubtext, { color: theme.subText }]}>  (Light / Dark)
    </Text>
    <Switch 
      value={isDark} 
      onValueChange={toggleTheme}
      trackColor={{ false: '#767577', true: theme.primary }}
      thumbColor={isDark ? '#fff' : '#f4f3f4'}
    />
  </View>
</SettingItem>
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.danger }]} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* --- MODALS --- */}

      {/* Change Name Modal */}
      <Modal
        visible={nameModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Change Name</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Enter new name"
              placeholderTextColor={theme.subText}
              value={newName}
              onChangeText={setNewName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setNameModalVisible(false)} style={styles.modalBtn}>
                <Text style={{ color: theme.subText }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangeName} style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.primary }]}>
                <Text style={{ color: '#000', fontWeight: 'bold' }}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={passModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Current Password"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="New Password"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Confirm New Password"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setPassModalVisible(false)} style={styles.modalBtn}>
                <Text style={{ color: theme.subText }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangePassword} style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.primary }]}>
                <Text style={{ color: '#000', fontWeight: 'bold' }}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 15,
  },
  avatarGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(176, 209, 255, 0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#1A1D23',
  },
  avatarLoading: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 55,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 20,
    paddingLeft: 5,
    letterSpacing: 1,
  },
  settingsCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  themeToggleSubtext: {
    fontSize: 12,
    marginRight: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 50,
    marginTop: 40,
    shadowColor: '#FF5247',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginLeft: 10,
  },
  modalBtnPrimary: {
    // backgroundColor: 'theme.primary' set dynamically
  }
});