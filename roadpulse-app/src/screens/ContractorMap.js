import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, StatusBar, Modal, TextInput, SafeAreaView
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0F1217" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F1217" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1A1D23" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0D1117" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] }
];

export default function ContractorMap() {
  const { theme, isDark, toggleTheme } = useTheme();

  const [blockades, setBlockades] = useState([]);
  const [currentDraft, setCurrentDraft] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockDays, setBlockDays] = useState("3");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);

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
      Alert.alert("Need 3 points", "Please tap on the map to define the roadblock area.");
      return;
    }

    const geo = currentDraft.map(p => [p.longitude, p.latitude]);
    geo.push([currentDraft[0].longitude, currentDraft[0].latitude]);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Session Expired", "Please login again.");
        return;
      }

      const res = await fetch(`${API_URL}/api/blockades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          coordinates: [geo],
          reason: blockReason,
          days: blockDays
        })
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentDraft([]);
        setModalVisible(false);
        setBlockReason("");
        setBlockDays("");
        setSuccessMessage("Blockage successfully added");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 4000);
      } else {
        Alert.alert("Error", data.message || "Failed to save blockade.");
      }
    } catch (err) {
      Alert.alert("Server Error", "Could not reach the database.");
    }
  };

  const clearAllBlockages = () => setConfirmClearVisible(true);

  const handleConfirmClear = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/blockades/clear`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        setBlockades([]);
        setConfirmClearVisible(false);
        setSuccessMessage("All blockages cleared");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 4000);
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to clear blockages.");
      }
    } catch (err) {
      Alert.alert("Server Error", "Could not reach the database.");
    }
  };

  const format = (coords) => coords[0].map(c => ({ longitude: c[0], latitude: c[1] }));
  const clearDraft = () => setCurrentDraft([]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* FLOATING HEADER */}
      <SafeAreaView style={styles.headerOverlay}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <View style={[styles.iconBox, { backgroundColor: theme.iconBg }]}>
            <Ionicons name="construct" size={24} color={theme.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Contractor Portal</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subText }]}>Live Road Blockade Management</Text>
          </View>
          {/* <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
            <Ionicons name={isDark ? "sunny" : "moon"} size={22} color={theme.text} />
          </TouchableOpacity> */}
        </View>

        {/* SUB-HEADER ACTIONS */}
        <View style={styles.subActions}>
          <View style={[styles.pill, { backgroundColor: theme.card }]}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={[styles.pillText, { color: theme.text }]}>{blockades.length} Active</Text>
          </View>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.danger }]} 
            onPress={clearAllBlockages}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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
            fillColor="rgba(255, 82, 71, 0.3)"
            strokeColor="#FF5247"
            strokeWidth={2}
          />
        ))}

        {currentDraft.map((p, i) => (
          <Marker key={i} coordinate={p}>
            <View style={[styles.draftMarker, { backgroundColor: theme.primary }]}>
              <Text style={styles.markerText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* DRAFTING OVERLAYS */}
      {currentDraft.length > 0 && (
        <View style={styles.draftOverlay}>
  <View style={[styles.draftPill, { backgroundColor: '#14171C' }]}>

    {/* TOP SECTION */}
    <View style={styles.draftTop}>
      <View style={styles.draftIconContainer}>
        <Ionicons name="create" size={18} color="#fff" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.draftTitle}>New Blockage</Text>
        <Text style={styles.draftSubtitle}>Tap map to place marker</Text>
      </View>
    </View>

    {/* BOTTOM ACTIONS */}
    <View style={styles.draftActions}>
      <TouchableOpacity onPress={clearDraft} style={styles.clearTextBtn}>
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.savePillBtn, { backgroundColor: theme.danger }]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.savePillBtnText}>Save Blockage</Text>
      </TouchableOpacity>
    </View>

  </View>
</View>
      )}

      {/* ADD BLOCKADE INSTRUCTION (WHEN NO DRAFT) */}
      {currentDraft.length === 0 && (
        <View style={styles.instructionContainer}>
          <View style={[styles.instructionBox, { backgroundColor: 'rgba(26, 29, 35, 0.9)' }]}>
            <Ionicons name="finger-print" size={24} color={theme.primary} />
            <Text style={[styles.instructionText, { color: theme.text }]}>
              Tap 3 points on map to define blockage
            </Text>
          </View>
        </View>
      )}

      {/* BLOCKAGE DETAILS MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: '#14171C' }]}>
            
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.alertCircle}>
                <Ionicons name="alert" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.modalTitleText}>Blockage Details</Text>
                <Text style={styles.modalSubtitleText}>Update status for the current grid sector</Text>
              </View>
            </View>

            {/* Detailed Reason */}
            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>DETAILED REASON</Text>
              <View style={styles.reasonInputContainer}>
                <TextInput
                  placeholder="Enter reason for blockage"
                  placeholderTextColor="#666"
                  value={blockReason}
                  onChangeText={setBlockReason}
                  style={styles.reasonInput}
                />
                <Ionicons name="create-outline" size={20} color="#666" style={styles.fieldIconRight} />
              </View>
            </View>

            {/* Estimated Clearance (Stepper) */}
            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>ESTIMATED CLEARANCE</Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity 
                  onPress={() => setBlockDays(prev => String(Math.max(1, parseInt(prev || 1) - 1)))}
                  style={styles.stepperBtn}
                >
                  <Ionicons name="remove-circle" size={32} color="#4285F4" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{blockDays}</Text>
                <TouchableOpacity 
                  onPress={() => setBlockDays(prev => String(parseInt(prev || 0) + 1))}
                  style={styles.stepperBtn}
                >
                  <Ionicons name="add-circle" size={32} color="#4285F4" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Info Text */}
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={16} color="#A0AEC0" />
              <Text style={styles.infoText}>
                Timeline affects automated route rerouting for local emergency services.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#B22A22' }]} onPress={saveRoadblock}>
                <Text style={styles.confirmBtnTextPremium}>Confirm Blockage</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelLink} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnTextPremium}>Cancel</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* CLEAR ALL CONFIRMATION MODAL */}
      <Modal visible={confirmClearVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalCard, { backgroundColor: '#14171C' }]}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="trash-outline" size={32} color="#FF5247" />
            </View>
            <Text style={styles.confirmTitle}>Clear All Blockades?</Text>
            <Text style={styles.confirmSubtitle}>
              This action will remove all active road hazards and broadcast the clearance to all drivers.
            </Text>
            
            <TouchableOpacity 
              style={[styles.confirmActionBtn, { backgroundColor: '#FF5247' }]} 
              onPress={handleConfirmClear}
            >
              <Text style={styles.confirmActionText}>Yes, Clear Everything</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.confirmCancelBtn} 
              onPress={() => setConfirmClearVisible(false)}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SUCCESS TOAST */}
      {showSuccess && (
        <View style={styles.toastOverlay}>
          <View style={[styles.toastContainer, { backgroundColor: '#14171C' }]}>
            <View style={styles.toastLeft}>
              <View style={[styles.successIconCircle, { backgroundColor: '#1F2228' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#1c8338ff" />
              </View>
              <View style={styles.toastTextContainer}>
                <Text style={styles.toastStatus}>SUCCESS</Text>
                <Text style={styles.toastMessage}>{successMessage}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowSuccess(false)} style={styles.toastClose}>
              <Ionicons name="close" size={20} color="#A0AEC0" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  themeToggle: {
    padding: 8,
  },
  subActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 50,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 8,
  },
  draftOverlay: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  draftPill: {
  padding: 15,
  borderRadius: 25,
  },
  draftTop: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 12,
},
  draftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  draftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  draftTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  draftSubtitle: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '600',
  },
  draftActions: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
  clearTextBtn: {
  paddingVertical: 8,
  paddingHorizontal: 15,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.1)',
  borderRadius: 20,
  padding:20,
},
  clearText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  savePillBtn: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 40,
    shadowColor: '#FF5247',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  savePillBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  instructionText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  draftMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    padding: 30,
    paddingBottom: 50,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    gap: 15,
  },
  alertCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 82, 71, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 71, 0.3)',
  },
  modalTitleText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitleText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  formSection: {
    marginBottom: 25,
  },
  fieldLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  reasonInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0E10',
    borderRadius: 18,
    paddingHorizontal: 15,
    height: 65,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reasonInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fieldIconRight: {
    marginLeft: 10,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0E10',
    borderRadius: 18,
    paddingHorizontal: 15,
    height: 65,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stepperBtn: {
    padding: 5,
  },
  stepperValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 40,
  },
  infoText: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  modalActions: {
    gap: 20,
  },
  confirmBtn: {
    height: 65,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B22A22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmBtnTextPremium: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelBtnTextPremium: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  toastOverlay: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  successIconCircle: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastStatus: {
    color: '#1c8338ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  toastMessage: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    },
  toastClose: {
    padding: 5,
    marginLeft: 10,
  },
  confirmModalCard: {
    width: '85%',
    backgroundColor: '#14171C',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  confirmIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 82, 71, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmSubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  confirmActionBtn: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  confirmActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  confirmCancelBtn: {
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    color: '#A0AEC0',
    fontSize: 15,
    fontWeight: '700',
  },
});
