import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
} from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import io from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from '../context/ThemeContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const AmbulanceMap = ({ navigation }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [blockades, setBlockades] = useState([]);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [intersections, setIntersections] = useState([]); // <-- NEW STATE
  const [isTracking, setIsTracking] = useState(false); // Controls the button state
  const [aiCommand, setAiCommand] = useState("");


  const [mapRegion, setMapRegion] = useState({
    latitude: 23.0225,
    longitude: 72.5714,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  const socketRef = useRef(null);
  const locationSubRef = useRef(null); // Holds the background tracking task

  useEffect(() => {
    fetchBlockades();

    socketRef.current = io(API_URL);
    socketRef.current.on("NEW_ROADBLOCK", (newBlockade) => {
      setBlockades((prev) => [...prev, newBlockade]);
    });

    // 🚦 Listen for smart intersections
    socketRef.current.on("INITIAL_INTERSECTIONS", (data) => {
      const formatted = data.map((int) => ({ ...int, status: "RED" }));
      setIntersections(formatted);
    });

    socketRef.current.on("SIGNAL_OVERRIDE", (update) => {
      setIntersections((prev) =>
        prev.map((int) =>
          int.id === update.intersectionId ? { ...int, status: update.status } : int
        )
      );
    });


    // Just grab the initial location to center the map (NOT continuous tracking)
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        let location = await Location.getCurrentPositionAsync({});
        setAmbulanceLocation(location.coords);
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });
      }
    })();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (locationSubRef.current) locationSubRef.current.remove(); // Clean up tracking on exit
    };
  }, []);

  const fetchBlockades = async () => {
    try {
      const response = await fetch(`${API_URL}/api/blockades`);
      const data = await response.json();
      if (response.ok) setBlockades(data);
    } catch (error) {
      console.error("Error fetching blockades:", error);
    }
  };

  const toggleTracking = async () => {
    if (isTracking) {
      // STOP TRACKING
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
      setIsTracking(false);
    } else {
      // START TRACKING
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please allow location access to broadcast.",
        );
        return;
      }

      setIsTracking(true);
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, 
          distanceInterval: 2, 
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          
          // 1. ADD THIS LOG: Proves the phone's GPS hardware is actually firing
          console.log(`\n📍 [AMBULANCE FRONTEND] GPS hardware moved: Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`); 

          setAmbulanceLocation({ latitude, longitude });
          setMapRegion((prev) => ({ ...prev, latitude, longitude })); 
          
          if (socketRef.current) {
            // 2. ADD THIS LOG: Proves the app is pushing to the server
            console.log(`📡 [AMBULANCE FRONTEND] Emitting to socket...`); 
            socketRef.current.emit('AMBULANCE_LOCATION_UPDATE', { latitude, longitude });
          }
        }
      );
    }
  };

  const handleAIVoiceCommand = async () => {
    if (!aiCommand.trim()) return;

    try {
      console.log("🧠 Sending to Gemini (Ambulance)...");
      // Using the updated 2.5 model
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`;

      const promptText = `You are an emergency vehicle AI assistant. The driver will give a command. Determine if they want to 'START' or 'STOP' their live location broadcasting. Return strictly valid JSON with a single key 'action' that is exactly 'START' or 'STOP'. Example: {"action": "START"}. User text: ${aiCommand}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      const data = await response.json();

      // Failsafe: Catch Google API errors
      if (data.error) {
        console.error("[GEMINI ERROR]", data.error);
        Alert.alert("API Error", data.error.message || "Failed to reach AI.");
        return;
      }

      const rawText = data.candidates[0].content.parts[0].text;
      const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleanedText);

      if (parsedData.action === "START") {
        if (!isTracking) await toggleTracking();
        Alert.alert("🤖 AI Agent", "Understood. Initiating Live Vanguard Broadcast.");
      } else if (parsedData.action === "STOP") {
        if (isTracking) await toggleTracking();
        Alert.alert("🤖 AI Agent", "Understood. Terminating Live Broadcast.");
      }
      
      setAiCommand("");

    } catch (error) {
      console.error("[AI PARSING ERROR]", error);
      Alert.alert("AI Error", "Failed to parse command.");
    }
  };
  
  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("role");
    if (socketRef.current) socketRef.current.disconnect();
    if (locationSubRef.current) locationSubRef.current.remove();
    navigation.replace("Login");
  };

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
        region={mapRegion}
        showsUserLocation={false} // We use the custom marker below
        customMapStyle={isDark ? darkMapStyle : []}
      >
        {blockades.map((blockade) => (
          <Polygon
            key={blockade._id}
            coordinates={formatPolygonCoords(blockade.location.coordinates)}
            fillColor="rgba(255, 0, 0, 0.3)"
            strokeColor="#FF3B30"
            strokeWidth={2}
          />
        ))}

        {ambulanceLocation && (
          <Marker coordinate={ambulanceLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.ambulanceMarker}>
              <View style={styles.ambulanceMarkerCore} />
            </View>
          </Marker>
        )}

        {/* 🚦 Render Smart Intersections */}
        {intersections.map((int) => (
          <Marker
            key={int.id}
            coordinate={{ latitude: int.lat, longitude: int.lng }}
            title={int.name}
          >
            <View style={styles.trafficLightPill}>
              <View
                style={[
                  styles.trafficLightCircle,
                  { backgroundColor: int.status === "GREEN" ? "#00FF00" : "#FF0000" },
                  int.status === "GREEN" && styles.glowGreen,
                  int.status === "RED" && styles.glowRed,
                ]}
              />
            </View>
          </Marker>
        ))}
      </MapView>


      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>Ambulance Mode</Text>
            <Text style={styles.subtitle}>
              {isTracking ? "📡 Broadcasting Live" : "⏸️ Tracking Paused"}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* AI Voice Command */}
        <View style={styles.aiCommandContainer}>
          <TextInput
            style={styles.aiCommandInput}
            placeholder="Say 'Start tracking'..."
            placeholderTextColor="#888"
            value={aiCommand}
            onChangeText={setAiCommand}
          />
          <TouchableOpacity
            style={styles.aiCommandButton}
            onPress={handleAIVoiceCommand}
          >
            <Text style={styles.buttonText}>Execute</Text>
          </TouchableOpacity>
        </View>

        {/* Tracking Toggle Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isTracking ? styles.stopButton : styles.startButton,
            ]}
            onPress={toggleTracking}
          >
            <Text style={styles.toggleButtonText}>
              {isTracking ? "Stop Tracking" : "Start Live Tracking"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

// ... keep your darkMapStyle JSON here ...
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
    pointerEvents: "box-none",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    margin: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  subtitle: { color: "#aaa", fontSize: 14, marginTop: 4 },
  logoutButton: { padding: 10, backgroundColor: "#333", borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  bottomContainer: { position: "absolute", bottom: 20, left: 20, right: 20 },
  toggleButton: {
    padding: 18,
    borderRadius: 30,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  startButton: { backgroundColor: "#34C759" }, // Green
  stopButton: { backgroundColor: "#FF3B30" }, // Red
  toggleButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  ambulanceMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  ambulanceMarkerCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#007AFF",
  },
  trafficLightPill: {
    width: 20,
    height: 36,
    backgroundColor: "#000",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  trafficLightCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  glowGreen: {
    shadowColor: "#00FF00",
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  glowRed: {
    shadowColor: "#FF0000",
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 8,
  },
  aiCommandContainer: {
    backgroundColor: "rgba(18, 18, 18, 0.9)",
    margin: 10,
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  aiCommandInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },
  aiCommandButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginLeft: 10,
  },
});


export default AmbulanceMap;