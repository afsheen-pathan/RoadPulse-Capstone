import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen({ navigation }) {

  const { theme, isDark, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const storedEmail = await AsyncStorage.getItem("email");
      setEmail(storedEmail || "user@example.com");
    };
    loadUser();
  }, []);

  const logout = async () => {
    await AsyncStorage.clear();
    navigation.replace("Login");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <Text style={styles.avatar}>👤</Text>
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
        <Text style={[styles.email, { color: theme.subText }]}>
          {email}
        </Text>
      </View>

      {/* SETTINGS CARD */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Settings
        </Text>

        {/* THEME TOGGLE */}
        <TouchableOpacity style={styles.row} onPress={toggleTheme}>
          <Text style={[styles.rowText, { color: theme.text }]}>
            {isDark ? "Switch to Light ☀️" : "Switch to Dark 🌙"}
          </Text>
        </TouchableOpacity>

      </View>

      {/* LOGOUT BUTTON */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({

  container:{
    flex:1,
    padding:20
  },

  header:{
    alignItems:'center',
    padding:25,
    borderRadius:20,
    marginBottom:20
  },

  avatar:{
    fontSize:50,
    marginBottom:10
  },

  title:{
    fontSize:22,
    fontWeight:'bold'
  },

  email:{
    marginTop:5,
    fontSize:14
  },

  card:{
    padding:20,
    borderRadius:15,
    marginBottom:20
  },

  sectionTitle:{
    fontSize:16,
    fontWeight:'bold',
    marginBottom:10
  },

  row:{
    paddingVertical:12
  },

  rowText:{
    fontSize:16
  },

  logoutBtn:{
    marginTop:'auto',
    backgroundColor:'#FF3B30',
    padding:15,
    borderRadius:12,
    alignItems:'center'
  },

  logoutText:{
    color:'#fff',
    fontSize:16,
    fontWeight:'bold'
  }

});