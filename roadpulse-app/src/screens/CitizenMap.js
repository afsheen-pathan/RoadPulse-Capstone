import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Vibration,
  Modal,
  Pressable,
  Alert,
  TextInput,
  Keyboard,
} from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import io from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// --- Task 13: Haversine Distance Helper ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // returns distance in meters
};

const CitizenMap = ({ navigation }) => {
  const [blockades, setBlockades] = useState([]);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null); // <-- NEW STATE
  const [intersections, setIntersections] = useState([]); // <-- NEW STATE

  const [mapRegion, setMapRegion] = useState({
    latitude: 23.0225,
    longitude: 72.5714,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });
  const [isEmergency, setIsEmergency] = useState(false);
  const [hydroReports, setHydroReports] = useState([]); // <-- NEW STATE
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const [activeHazardAlert, setActiveHazardAlert] = useState(null); // <-- Task 13
  const [currentLocation, setCurrentLocation] = useState(null); // <-- NEW STATE (Fixes Stale Closure)

  // --- Task 15: Warning System States ---
  const [destination, setDestination] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRouteCompromised, setIsRouteCompromised] = useState(false);
  const [aiText, setAiText] = useState("");

  const socketRef = useRef(null);
  const locationSubRef = useRef(null); // holds the tracking subscription
  const hasPrompted = useRef(false); // <-- Task 14: One-time prompt ref
  const idleTimerRef = useRef(null); // <-- NEW: Tracks vehicle idling

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10, // 10 meters distance interval
          },
          (location) => {
            const { latitude, longitude, speed } = location.coords;

            // Update auto-center map view
            setMapRegion((prev) => ({
              ...prev,
              latitude,
              longitude,
            }));

            // Emit to server
            if (socketRef.current) {
              console.log("📡 [CITIZEN FRONTEND] Emitting location update...");
              socketRef.current.emit("CITIZEN_LOCATION_UPDATE", {
                latitude,
                longitude,
              });
            }

            // Update current location for reactive radar
            setCurrentLocation({ latitude, longitude });

            const currentSpeed = (speed === null || speed < 0) ? 0 : speed;
            
            console.log(`[ECO-DRIVE] Current Speed: ${currentSpeed} m/s`);

            if (currentSpeed < 0.5) {
              if (idleTimerRef.current === null) {
                console.log("⏱️ Vehicle stopped. Starting Eco-Timer...");
                idleTimerRef.current = setTimeout(() => {
                  Alert.alert(
                    "🌱 Eco-Drive Alert",
                    "You have been idling for 2 minutes. Please turn off your engine to reduce emissions and save fuel."
                  );
                }, 120000); // 🚨 Set to 120000 (2 minutes) 
              }
            } else {
              if (idleTimerRef.current !== null) {
                console.log("🚗 Vehicle moving. Canceling Eco-Timer.");
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
              }
            }
          },
        );
      }
    })();

    fetchBlockades();

    socketRef.current = io(API_URL);

    // Listen for new roadblocks
    socketRef.current.on("NEW_ROADBLOCK", (newBlockade) => {
      setBlockades((prev) => [...prev, newBlockade]);
    });

    // <-- NEW: Listen for the live ambulance -->
    socketRef.current.on("LIVE_AMBULANCE_TRACKING", (locationData) => {
      // 🚨 ADDED LOG: Proves the Citizen app successfully heard the server's broadcast!
      console.log(
        "\n🚨 [CITIZEN FRONTEND] RECEIVED LIVE DATA FROM SERVER:",
        locationData,
      );

      setAmbulanceLocation({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
      });
    });

    // 🌊 Listen for Hydro-Reports
    socketRef.current.on("INITIAL_HYDRO_REPORTS", (reports) => {
      setHydroReports(reports);
    });

    socketRef.current.on("NEW_HYDRO_REPORT", (newReport) => {
      setHydroReports((prev) => [...prev, newReport]);
    });

    // --- Task 14: Cleanup Listeners ---
    socketRef.current.on("REMOVE_HYDRO_REPORT", (reportId) => {
      console.log(`\n[4. FRONTEND RECEIVE] Server sent REMOVE_HYDRO_REPORT!`);
      console.log(`[4. FRONTEND RECEIVE] ID to delete: ${reportId}`);

      setHydroReports((prev) => {
        console.log(
          `[5. REACT STATE] Current array length before filter: ${prev.length}`,
        );

        // Check if the ID exists in React's memory
        const doesExist = prev.some((r) => r._id === reportId);
        console.log(
          `[5. REACT STATE] Does ID ${reportId} exist in current state? : ${
            doesExist ? "YES ✅" : "NO ❌"
          }`,
        );

        const newArray = prev.filter((r) => r._id !== reportId);
        console.log(
          `[5. REACT STATE] New array length after filter: ${newArray.length}`,
        );

        return newArray;
      });
    });

    socketRef.current.on("UPDATE_HYDRO_REPORT", (updatedReport) => {
      setHydroReports((prev) =>
        prev.map((r) => (r._id === updatedReport._id ? updatedReport : r)),
      );
    });

    // 🚦 Listen for smart intersections

    socketRef.current.on("INITIAL_INTERSECTIONS", (data) => {
      const formatted = data.map((int) => ({ ...int, status: "RED" }));
      setIntersections(formatted);
    });

    socketRef.current.on("SIGNAL_OVERRIDE", (update) => {
      setIntersections((prev) =>
        prev.map((int) =>
          int.id === update.intersectionId
            ? { ...int, status: update.status }
            : int,
        ),
      );
    });

    // 🚨 NEW: Emergency Clear Path Alert

    socketRef.current.on("CLEAR_PATH", () => {
      console.log("🔥 [CITIZEN] EMERGENCY: AMBULANCE IN VANGUARD BUBBLE!");

      // 📳 Haptic Warning
      Vibration.vibrate([0, 500, 200, 500]);

      // ⚠️ Show Overlay
      setIsEmergency(true);

      // Reset after 10 seconds
      setTimeout(() => {
        setIsEmergency(false);
      }, 10000);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (locationSubRef.current) {
        locationSubRef.current.remove();
      }
    };
  }, []);

  // --- Task 13.1: Reactive Radar (Fixes Stale Closure) ---
  useEffect(() => {
    if (!currentLocation) return;
    let triggeredAlert = null;

    // Sweep 1: Floods
    for (const report of hydroReports) {
      const lng = report.location.coordinates[0];
      const lat = report.location.coordinates[1];
      const dist = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        lat,
        lng,
      );

      if (dist < 500 && (report.depth === "Knee" || report.depth === "Waist")) {
        triggeredAlert = `🌊 HAZARD: Severe Waterlogging Ahead (${Math.round(
          dist,
        )}m)`;

        // --- Task 14: Proximity Ping Logic ---
        if (!hasPrompted.current) {
          hasPrompted.current = true;
          Alert.alert(
            "Local Hazard Check",
            "You are near a reported waterlogging zone. Is it still flooded?",
            [
              {
                text: "No, It's Clear",
                onPress: () => {
                  console.log(
                    `\n[1. FRONTEND EMIT] Tapped "No". Emitting VERIFY_HYDRO_REPORT...`,
                  );
                  console.log(
                    `[1. FRONTEND EMIT] Payload -> reportId: ${report._id}, isStillThere: false`,
                  );
                  socketRef.current.emit("VERIFY_HYDRO_REPORT", {
                    reportId: report._id,
                    isStillThere: false,
                  });
                },
              },
              {
                text: "Yes, Still Here",
                onPress: () =>
                  socketRef.current.emit("VERIFY_HYDRO_REPORT", {
                    reportId: report._id,
                    isStillThere: true,
                  }),
              },
            ],
          );
        }
        break;
      }
    }

    // Sweep 2: Blockades
    if (!triggeredAlert) {
      for (const blockade of blockades) {
        const lng = blockade.location.coordinates[0][0][0];
        const lat = blockade.location.coordinates[0][0][1];
        const dist = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          lat,
          lng,
        );

        if (dist < 500) {
          triggeredAlert = `🚧 HAZARD: Construction Blockade Ahead (${Math.round(
            dist,
          )}m)`;
          break;
        }
      }
    }

    setActiveHazardAlert(triggeredAlert);
  }, [currentLocation, hydroReports, blockades]);

  const fetchBlockades = async () => {
    try {
      const response = await fetch(`${API_URL}/api/blockades`);
      const data = await response.json();
      if (response.ok) setBlockades(data);
    } catch (error) {
      console.error("Error fetching blockades:", error);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("role");
    if (socketRef.current) socketRef.current.disconnect();
    if (locationSubRef.current) {
      locationSubRef.current.remove();
    }
    navigation.replace("Login");
  };

  const formatPolygonCoords = (geoJsonCoords) => {
    return geoJsonCoords[0].map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
    }));
  };

  const handleLongPress = (e) => {
    setSelectedCoordinate(e.nativeEvent.coordinate);
    setReportModalVisible(true);
  };

  const submitHydroReport = (depth) => {
    if (socketRef.current && selectedCoordinate) {
      socketRef.current.emit("ADD_HYDRO_REPORT", {
        latitude: selectedCoordinate.latitude,
        longitude: selectedCoordinate.longitude,
        depth: depth,
      });
    }
    setReportModalVisible(false);
    setSelectedCoordinate(null);
  };

  // --- Task 15: ZERO-API Headless Routing & Collision Engine ---
  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentLocation) return;
    Keyboard.dismiss(); 
    
    try {
      // 1. Hyper-Local Text Enhancer
      let optimizedQuery = searchQuery;
      const lowerQuery = optimizedQuery.toLowerCase();

      // If they just typed a place name (e.g., "Himalaya Mall"), force Ahmedabad context
      if (!lowerQuery.includes("ahmedabad")) {
          optimizedQuery = `${searchQuery}, Ahmedabad, Gujarat, India`;
      } else if (!lowerQuery.includes("india")) {
          optimizedQuery = `${searchQuery}, India`; 
      }

      console.log(`[HYPER-LOCAL GEOCODER] Searching for: ${optimizedQuery}`);
      
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(optimizedQuery)}&countrycodes=in&viewbox=72.45,23.15,72.75,22.90&bounded=1&limit=1`;
      
      const geoRes = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'RoadPulse-Capstone-App/1.0 (Student Project)',
          'Accept': 'application/json'
        }
      });
      const geoData = await geoRes.json();

      if (geoData && geoData.length > 0) {
        let destLat = parseFloat(geoData[0].lat);
        let destLng = parseFloat(geoData[0].lon);
        let displayName = geoData[0].display_name.split(',')[0]; // Grab just the local name
        setDestination({ latitude: destLat, longitude: destLng });

        console.log(`[ROUTING] Generating simulated algorithmic path to ${displayName}...`);
        
        // 2. Simulated Routing Math (Interpolate 20 points between Citizen and Destination)
        const waypoints = [];
        const numPoints = 20; 
        for (let i = 0; i <= numPoints; i++) {
            waypoints.push({
                lat: currentLocation.latitude + ((destLat - currentLocation.latitude) * (i / numPoints)),
                lng: currentLocation.longitude + ((destLng - currentLocation.longitude) * (i / numPoints))
            });
        }

        let hazardFound = false;
        let hazardType = "";

        // 3. The Collision Engine (Checking your generated path against the database)
        for (const point of waypoints) {
            
            // Check active Floods
            for (const report of hydroReports) {
                if (report.depth === "Knee" || report.depth === "Waist") {
                    const dist = calculateDistance(point.lat, point.lng, report.location.coordinates[1], report.location.coordinates[0]);
                    if (dist < 300) { // 300m collision radius for the simulation
                        hazardFound = true;
                        hazardType = `🌊 Severe Waterlogging (${report.depth} Deep)`;
                        break;
                    }
                }
            }
            if (hazardFound) break;

            // Check active Blockades
            for (const blockade of blockades) {
                const dist = calculateDistance(point.lat, point.lng, blockade.location.coordinates[0][0][1], blockade.location.coordinates[0][0][0]);
                if (dist < 300) {
                    hazardFound = true;
                    hazardType = "🚧 Active Construction Blockade";
                    break;
                }
            }
            if (hazardFound) break;
        }

        // 4. The Final Verdict Native Alert
        if (hazardFound) {
            Alert.alert(
              "🚨 Route Compromised",
              `Your path to ${displayName.toUpperCase()} intersects with:\n\n${hazardType}\n\nWarning: Proceed with extreme caution or divert.`
            );
        } else {
            Alert.alert(
              "✅ Route Clear", 
              `No reported hazards detected on the vector to ${displayName.toUpperCase()}. Safe travels!`
            );
        }
        // ADD THIS LINE: Clear the search bar after a successful search!
        setSearchQuery("");

      } else {
        Alert.alert(
          "📍 Location Not Found",
          "Could not find that exact location in Ahmedabad. Try using a nearby landmark or spelling out the full name."
        );
      }
    } catch (error) {
      console.error('[OPEN-SOURCE ENGINE ERROR]', error.message);
      Alert.alert("Network Error", "Could not reach the open-source routing servers.");
    }
  };

  // const handleAICommand = async () => {
  //   if (!aiText.trim() || !currentLocation) return;
    
  //   try {
  //     const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`;
      
  //     const response = await fetch(url, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         contents: [
  //           {
  //             parts: [
  //               {
  //                 text: "You are a hazard parsing AI. The user will report a flood. Extract the depth as either 'Ankle', 'Knee', or 'Waist'. If unsure, default to 'Ankle'. Return strictly valid JSON with a single key 'depth'. Example: {\"depth\": \"Waist\"}. User text: " + aiText,
  //               },
  //             ],
  //           },
  //         ],
  //       }),
  //     });

  //     const data = await response.json();
  //     const rawText = data.candidates[0].content.parts[0].text;
  //     const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "");
  //     const parsedData = JSON.parse(cleanJson);

  //     if (socketRef.current) {
  //       socketRef.current.emit("ADD_HYDRO_REPORT", {
  //         latitude: currentLocation.latitude,
  //         longitude: currentLocation.longitude,
  //         depth: parsedData.depth,
  //       });
  //       Alert.alert(
  //         "🤖 AI Agent",
  //         `Hazard recognized. ${parsedData.depth}-deep flood reported at your location.`
  //       );
  //     }
  //     setAiText("");
  //   } catch (error) {
  //     console.error("AI Command Error:", error);
  //     Alert.alert("AI Error", "Failed to parse hazard report.");
  //   }
  // };

  const handleAICommand = async () => {
    if (!aiText.trim() || !currentLocation) return;

    try {
      console.log("🧠 Sending to Gemini...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`;

      const promptText = `You are a hazard parsing AI. The user will report a flood. Extract the depth as either 'Ankle', 'Knee', or 'Waist'. If unsure, default to 'Ankle'. Return strictly valid JSON with a single key 'depth'. Example: {"depth": "Waist"}. User text: ${aiText}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      const data = await response.json();

      // Failsafe: Catch Gemini API errors (e.g., bad API key)
      if (data.error) {
        console.error("[GEMINI ERROR]", data.error);
        Alert.alert("API Error", data.error.message || "Failed to reach AI.");
        return;
      }

      const rawText = data.candidates[0].content.parts[0].text;
      const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleanedText);

      if (socketRef.current) {
        socketRef.current.emit("ADD_HYDRO_REPORT", {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          depth: parsedData.depth
        });
        Alert.alert("🤖 AI Agent", `Hazard recognized. ${parsedData.depth}-deep flood reported at your location.`);
      }
      setAiText("");

    } catch (error) {
      console.error("[AI PARSING ERROR]", error);
      Alert.alert("AI Error", "Failed to parse hazard report.");
    }
  };
  const getHydroColor = (depth) => {
    switch (depth) {
      case "Ankle":
        return "#3498db"; // Light Blue
      case "Knee":
        return "#2980b9"; // Medium Blue
      case "Waist":
        return "#8e44ad"; // Dark Blue/Purple (Danger)
      default:
        return "#3498db";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* --- Background Layer: The Map --- */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        customMapStyle={darkMapStyle}
        onLongPress={handleLongPress}
      >
        {/* Render Roadblocks */}
        {blockades.map((blockade) => (
          <Polygon
            key={blockade._id}
            coordinates={formatPolygonCoords(blockade.location.coordinates)}
            fillColor="rgba(255, 0, 0, 0.3)"
            strokeColor="#FF3B30"
            strokeWidth={2}
          />
        ))}

        {/* Render Live Ambulance */}
        {ambulanceLocation && (
          <Marker coordinate={ambulanceLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.citizenAmbulanceMarker}>
              <View style={styles.citizenAmbulanceMarkerCore} />
            </View>
          </Marker>
        )}

        {/* 🌊 Render Waterlogging Reports */}
        {hydroReports.map((report) => (
          <Marker
            key={report._id}
            coordinate={{
              latitude: report.location.coordinates[1],
              longitude: report.location.coordinates[0],
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={[
                styles.hydroMarker,
                { backgroundColor: getHydroColor(report.depth) },
              ]}
            >
              <Text style={styles.hydroEmoji}>🌊</Text>
            </View>
          </Marker>
        ))}

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
                  {
                    backgroundColor:
                      int.status === "GREEN" ? "#00FF00" : "#FF0000",
                  },
                  int.status === "GREEN" && styles.glowGreen,
                  int.status === "RED" && styles.glowRed,
                ]}
              />
            </View>
          </Marker>
        ))}

        {/* --- Simulated Routing Math for Hazard Detection is handled in handleSearch --- */}
      </MapView>

      {/* --- Foreground Layer: UI Overlays --- */}
      {/* 🛠️ ADDED pointerEvents="box-none" HERE TO FIX THE GHOST BOX BUG 🛠️ */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Citizen Dashboard</Text>
            <Text style={styles.subtitle}>
              {ambulanceLocation
                ? "🚨 Live Ambulance in Area"
                : "Live Traffic & Blockades"}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Radar Banner */}
        {activeHazardAlert && (
          <View style={styles.hazardBanner}>
            <Text style={styles.hazardText}>{activeHazardAlert}</Text>
          </View>
        )}

        {/* Search Container */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Where to?"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        {/* AI Command Input */}
        <View style={styles.aiContainer}>
          <TextInput
            style={styles.aiInput}
            placeholder="Describe hazard (use keyboard mic)..."
            placeholderTextColor="#888"
            value={aiText}
            onChangeText={setAiText}
          />
          <TouchableOpacity style={styles.aiButton} onPress={handleAICommand}>
            <Text style={styles.aiButtonText}>Send to AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 🌊 REPORT WATERLOGGING MODAL 🌊 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReportModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Waterlogging</Text>
              <Text style={styles.modalSubtitle}>
                How deep is the water here?
              </Text>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={[styles.depthBtn, { backgroundColor: "#3498db" }]}
                onPress={() => submitHydroReport("Ankle")}
              >
                <Text style={styles.depthBtnText}>Ankle Deep</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.depthBtn, { backgroundColor: "#2980b9" }]}
                onPress={() => submitHydroReport("Knee")}
              >
                <Text style={styles.depthBtnText}>Knee Deep</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.depthBtn, { backgroundColor: "#8e44ad" }]}
                onPress={() => submitHydroReport("Waist")}
              >
                <Text style={styles.depthBtnText}>Waist Deep (Danger)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 🚨 HIGH-VISIBILITY WARNING OVERLAY 🚨 */}

      {isEmergency && (
        <View style={styles.emergencyOverlay}>
          <Text style={styles.emergencyTitle}>🚨 AMBULANCE APPROACHING</Text>
          <Text style={styles.emergencySubtitle}>PULL OVER IMMEDIATELY</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// Standard Dark Theme
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
  container: { flex: 1, backgroundColor: "#121212" },
  map: { ...StyleSheet.absoluteFillObject },
  topOverlay: {
    position: "absolute",
    top: 50,
    width: "100%",
    paddingHorizontal: 15,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(28, 28, 30, 0.95)",
    padding: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchContainer: {
    flexDirection: "row",
    marginTop: 15,
    backgroundColor: "rgba(44, 44, 46, 0.9)",
    borderRadius: 12,
    paddingHorizontal: 15,
    alignItems: "center",
    height: 55,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    height: "100%",
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: "#3498db",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginLeft: 10,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  subtitle: {
    color: "#FF453A",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "bold",
  },
  logoutButton: { padding: 10, backgroundColor: "#FF3B30", borderRadius: 8 },
  logoutText: { color: "#fff", fontWeight: "bold" },
  citizenAmbulanceMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  citizenAmbulanceMarkerCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
  }, // Red core for citizen view
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
  emergencyOverlay: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#FF3B30",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFF",
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  emergencyTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  emergencySubtitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
    letterSpacing: 1,
  },
  hazardBanner: {
    backgroundColor: "#f39c12",
    padding: 10,
    marginTop: 5,
    borderRadius: 8,
    alignItems: "center",
  },
  hazardText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
  hydroMarker: {
    padding: 2,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 10,
    borderWidth: 2,
    borderColor: "#fff",
  },
  hydroEmoji: {
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalHeader: {
    marginBottom: 20,
    alignItems: "center",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },
  modalSubtitle: {
    color: "#aaa",
    fontSize: 16,
  },
  modalOptions: {
    gap: 12,
  },
  depthBtn: {
    padding: 16,
    borderRadius: 15,
    alignItems: "center",
  },
  depthBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelBtn: {
    padding: 16,
    alignItems: "center",
    marginTop: 5,
  },
  cancelBtnText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "bold",
  },
  aiContainer: {
    flexDirection: "row",
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 15,
    alignItems: "center",
    height: 50,
  },
  aiInput: {
    flex: 1,
    color: "#000",
    fontSize: 14,
  },
  aiButton: {
    backgroundColor: "#2ecc71",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  aiButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
});

export default CitizenMap;