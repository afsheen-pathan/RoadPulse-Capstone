import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const ContractorMap = ({ navigation }) => {
  const [blockades, setBlockades] = useState([]);
  const [currentDraft, setCurrentDraft] = useState([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: 23.0225, // Default to Ahmedabad
    longitude: 72.5714,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const socketRef = useRef(null);

  useEffect(() => {
    // 1. Get Live GPS Location
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access to center the map.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.015, // Zoomed in closer for street-level view
        longitudeDelta: 0.015,
      });
    })();

    // 2. Initial Data Fetch
    fetchBlockades();

    // 3. Socket Connection Setup
    socketRef.current = io(API_URL);

    socketRef.current.on('connect', () => {
      console.log('🔌 Connected to Socket.io server');
    });

    socketRef.current.on('NEW_ROADBLOCK', (newBlockade) => {
      console.log('🚧 New roadblock received from socket:', newBlockade);
      setBlockades((prev) => [...prev, newBlockade]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchBlockades = async () => {
    try {
      const response = await fetch(`${API_URL}/api/blockades`);
      const data = await response.json();
      if (response.ok) {
        setBlockades(data);
      } else {
        console.error('Failed to fetch blockades:', data.message);
      }
    } catch (error) {
      console.error('Error fetching blockades:', error);
    }
  };

  const handleMapPress = (e) => {
    const { coordinate } = e.nativeEvent;
    setCurrentDraft((prev) => [...prev, coordinate]);
  };

  const saveRoadblock = async () => {
    if (currentDraft.length < 3) {
      Alert.alert('Error', 'A roadblock must have at least 3 points.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token found. Please log in again.');
        return;
      }

      // Convert [{latitude, longitude}] to [[[longitude, latitude], ...]]
      // GeoJSON Polygons should close (first point == last point)
      const geoPoints = currentDraft.map((p) => [p.longitude, p.latitude]);
      geoPoints.push([currentDraft[0].longitude, currentDraft[0].latitude]);

      const payload = {
        coordinates: [geoPoints],
        reason: 'Emergency Road Work',
      };

      const response = await fetch(`${API_URL}/api/blockades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Roadblock saved and broadcasted.');

        // Emit via socket
        socketRef.current.emit('ADD_ROADBLOCK', data);

        // Clear draft
        setCurrentDraft([]);
      } else {
        Alert.alert('Error', data.message || 'Failed to save roadblock.');
      }
    } catch (error) {
      console.error('Save Roadblock Error:', error);
      Alert.alert('Error', 'Could not save roadblock.');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('role');
      // If socket is open, disconnect it before leaving
      if (socketRef.current) socketRef.current.disconnect();
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const clearDraft = () => {
    setCurrentDraft([]);
  };

  // Helper to format GeoJSON coordinates for Polygon component
  const formatPolygonCoords = (geoJsonCoords) => {
    return geoJsonCoords[0].map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
    }));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion} // Ensures the map moves when GPS is found
        showsUserLocation={true} // Shows the blue dot for your location
        showsMyLocationButton={true}
        onPress={handleMapPress}
        customMapStyle={darkMapStyle}
      >
        {/* Render Saved Blockades */}
        {blockades.map((blockade) => (
          <Polygon
            key={blockade._id}
            coordinates={formatPolygonCoords(blockade.location.coordinates)}
            fillColor="rgba(255, 0, 0, 0.3)"
            strokeColor="#FF3B30"
            strokeWidth={2}
          />
        ))}

        {/* Render Current Draft */}
        {currentDraft.length > 0 && (
          <>
            <Polygon
              coordinates={currentDraft}
              fillColor="rgba(255, 69, 58, 0.4)"
              strokeColor="#FF453A"
              strokeWidth={3}
            />
            {currentDraft.map((point, index) => (
              <Marker
                key={index}
                coordinate={point}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.markerDot} />
              </Marker>
            ))}
          </>
        )}
      </MapView>

      {/* Floating UI */}
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.topBar, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <View>
            <Text style={styles.title}>Contractor Mode</Text>
            <Text style={styles.subtitle}>Tap map to draw a roadblock</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={{ padding: 10, backgroundColor: '#FF3B30', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Logout</Text>
          </TouchableOpacity>
        </View>


        {currentDraft.length > 0 && (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={clearDraft}
            >
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>

            {currentDraft.length >= 3 && (
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={saveRoadblock}
              >
                <Text style={styles.buttonText}>Save Roadblock</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

// Dark Map Style JSON (Standard configuration)
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#263c3f" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#6b9a76" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#38414e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#212a37" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9ca5b3" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#1f2835" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#f3d19c" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#17263c" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#515c6d" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#17263c" }]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
    pointerEvents: 'box-none',
  },
  topBar: {
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    padding: 15,
    margin: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  buttonsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  clearButton: {
    backgroundColor: '#333',
    width: '30%',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#FF3B30',
    width: '65%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default ContractorMap;