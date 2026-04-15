import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, StatusBar, Modal, TextInput
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const API_URL = "http://10.42.96.103:5000";

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
];

export default function ContractorMap() {

 const { theme, isDark, toggleTheme } = useTheme();

  const [blockades, setBlockades] = useState([]);
  const [currentDraft, setCurrentDraft] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockDays, setBlockDays] = useState("");

  const [mapRegion, setMapRegion] = useState({
    latitude: 23.0225,
    longitude: 72.5714,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const socketRef = useRef(null);

  useEffect(() => {

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();

    fetchBlockades();

    socketRef.current = io(API_URL);

    socketRef.current.on('NEW_ROADBLOCK', (newBlockade) => {
      setBlockades(prev => {
        const exists = prev.some(b => b._id === newBlockade._id);
        if (exists) return prev;
        return [...prev, newBlockade];
      });
    });

    socketRef.current.on('REMOVE_ALL_BLOCKADES', () => {
      setBlockades([]);
    });

    // ✅ CORRECT CLEANUP
    return () => {
      socketRef.current?.disconnect();
    };

  }, []);

  const fetchBlockades = async () => {
    try {
      const res = await fetch(`${API_URL}/api/blockades`);
      const data = await res.json();
      if (res.ok) setBlockades(data);
    } catch (err) {
      console.log(err);
    }
  };

  const handleMapPress = (e) => {
    const coord = e.nativeEvent?.coordinate;
    if (!coord) return;
    setCurrentDraft(prev => [...prev, coord]);
  };

  const saveRoadblock = async () => {
  if (currentDraft.length < 3) {
    Alert.alert("Need 3 points");
    return;
  }

  const geo = currentDraft.map(p => [p.longitude, p.latitude]);
  geo.push([currentDraft[0].longitude, currentDraft[0].latitude]);

  try {
    const token = await AsyncStorage.getItem("token"); // 🔥 FIX

    if (!token) {
      Alert.alert("Login expired. Please login again.");
      return;
    }

    const res = await fetch(`${API_URL}/api/blockades`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` // 🔥 REQUIRED
      },
      body: JSON.stringify({
        coordinates: [geo],
        reason: blockReason,
        days: blockDays
      })
    });

    const data = await res.json();
    console.log("SAVE RESPONSE:", data); // debug

    if (res.ok) {
      setCurrentDraft([]);
      setModalVisible(false);
      setBlockReason("");
      setBlockDays("");

      Alert.alert("Blockage added");

    } else {
      Alert.alert(data.message || "Failed to save");
    }

  } catch (err) {
    console.log("SAVE ERROR:", err);
    Alert.alert("Server error");
  }
};

  const clearAllBlockages = async () => {
  try {
    const token = await AsyncStorage.getItem("token"); // 🔥 important

    const res = await fetch(`${API_URL}/api/blockades/clear`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` // 🔥 FIX
      }
    });

    const data = await res.json();
    console.log("CLEAR RESPONSE:", data);

    if (res.ok) {
      setBlockades([]);
      Alert.alert("All blockages cleared");
    } else {
      Alert.alert(data.message || "Failed to clear");
    }

  } catch (err) {
    console.log("CLEAR ERROR:", err);
    Alert.alert("Server not reachable");
  }
};

  const format = (coords) =>
    coords[0].map(c => ({ longitude: c[0], latitude: c[1] }));

  const clearDraft = () => {
  setCurrentDraft([]);
};

  return (
    <View style={{ flex:1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>🚧 Contractor Dashboard</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.clearBtnBox} onPress={clearAllBlockages}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsDark(!isDark)}>
            <Text style={styles.toggle}>{isDark ? "☀️" : "🌙"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation
        customMapStyle={isDark ? darkMapStyle : []}
        onPress={handleMapPress}
      >
        {blockades.map(b => (
          <Polygon
            key={b._id}
            coordinates={format(b.location.coordinates)}
            fillColor="rgba(255,0,0,0.3)"
            strokeColor="red"
          />
        ))}

        {currentDraft.map((p,i)=>(
          <Marker key={i} coordinate={p} />
        ))}
      </MapView>

      {currentDraft.length > 0 && (
  <View style={styles.bottomActions}>

    {/* Clear Draft */}
    <TouchableOpacity style={styles.clearDraftBtn} onPress={clearDraft}>
      <Text style={styles.btnText}>Clear</Text>
    </TouchableOpacity>

    {/* Save Button */}
    {currentDraft.length >= 3 && (
      <TouchableOpacity style={styles.saveBtn} onPress={()=>setModalVisible(true)}>
        <Text style={styles.btnText}>Save</Text>
      </TouchableOpacity>
    )}

  </View>
)}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>

            <Text style={styles.modalTitle}>🚧 Blockage Details</Text>

            <TextInput
              placeholder="Enter Reason"
              placeholderTextColor="#aaa"
              value={blockReason}
              onChangeText={setBlockReason}
              style={styles.input}
            />

            <TextInput
              placeholder="Days to Clear"
              placeholderTextColor="#aaa"
              value={blockDays}
              onChangeText={setBlockDays}
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={saveRoadblock}>
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  map:{ flex:1 },

  header:{
    position:'absolute',
    top:50,
    left:15,
    right:15,
    zIndex:10,
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    backgroundColor:"#1c1c1e",
    padding:15,
    borderRadius:15
  },

  title:{
    fontSize:18,
    fontWeight:'bold',
    color:'#fff',
    flex:1
  },

  actions:{
    flexDirection:'row',
    alignItems:'center',
    gap:10
  },

  clearBtnBox:{
    backgroundColor:"#ff3b30",
    paddingHorizontal:10,
    paddingVertical:6,
    borderRadius:8
  },

  clearBtnText:{
    color:"#fff",
    fontSize:12,
    fontWeight:"bold"
  },

  toggle:{
    color:"orange",
    fontSize:16
  },

  btn:{
    position:'absolute',
    bottom:40,
    left:20,
    right:20,
    backgroundColor:"red",
    padding:15,
    alignItems:'center',
    borderRadius:10
  },

  modalBg:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:"rgba(0,0,0,0.6)"
  },

  modalBox:{
    width:"90%",
    backgroundColor:"#1c1c1e",
    padding:20,
    borderRadius:15
  },

  modalTitle:{
    color:"#fff",
    fontSize:18,
    marginBottom:15,
    textAlign:"center"
  },

  input:{
    color:"#fff",
    borderBottomWidth:1,
    borderColor:"#555",
    marginBottom:20
  },

  confirmBtn:{
    backgroundColor:"#FF3B30",
    padding:15,
    borderRadius:10,
    alignItems:"center"
  },

  confirmText:{
    color:"#fff",
    fontWeight:"bold"
  },

  cancelText:{
    color:"red",
    textAlign:"center",
    marginTop:15
  },
  bottomActions:{
  position:'absolute',
  bottom:40,
  left:20,
  right:20,
  flexDirection:'row',
  justifyContent:'space-between'
},

clearDraftBtn:{
  backgroundColor:"#444",
  padding:15,
  borderRadius:10,
  width:'35%',
  alignItems:'center'
},

saveBtn:{
  backgroundColor:"red",
  padding:15,
  borderRadius:10,
  width:'60%',
  alignItems:'center'
},

btnText:{
  color:"#fff",
  fontWeight:"bold"
}
});