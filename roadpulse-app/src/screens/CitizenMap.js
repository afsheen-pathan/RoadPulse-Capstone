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
  ScrollView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import io from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";
import { Polyline } from "react-native-maps";

const API_URL = "http://10.42.96.103:5000";

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
  const { theme, isDark, toggleTheme } = useTheme();
  const [blockades, setBlockades] = useState([]);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null); // <-- NEW STATE
  const [intersections, setIntersections] = useState([]); // <-- NEW STATE
  const [uiAlert, setUiAlert] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [altRoutePoints, setAltRoutePoints] = useState([]);

  const showCenterAlert = (title, message, actions = [], metadata = {}) => {
    setCenterAlert({ title, message, actions, metadata });
  };

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
  const [centerAlert, setCenterAlert] = useState(null);
  // --- Task 15: Warning System States ---
  const [destination, setDestination] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRouteCompromised, setIsRouteCompromised] = useState(false);
  const [aiText, setAiText] = useState("");
  const [showControls, setShowControls] = useState(false); // Toggle for bottom panel

  const socketRef = useRef(null);
  const locationSubRef = useRef(null); // holds the tracking subscription
  const promptedHazards = useRef(new Set()); // <-- Task 14: Per-hazard prompt set
  const idleTimerRef = useRef(null); // <-- NEW: Tracks vehicle idling
  const [justReported, setJustReported] = useState(false);
  const hazardCooldowns = useRef({ waterlogging: 0, blockade: 0 });

  const [panelMode, setPanelMode] = useState("navigate");
  // "navigate" | "report"

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

            const currentSpeed = speed === null || speed < 0 ? 0 : speed;

            console.log(`[ECO-DRIVE] Current Speed: ${currentSpeed} m/s`);

            if (currentSpeed < 0.5) {
              if (idleTimerRef.current === null) {
                console.log("⏱️ Vehicle stopped. Starting Eco-Timer...");

                idleTimerRef.current = setTimeout(() => {
                  idleTimerRef.current = null;

                  showCenterAlert(
                    "🌱 Eco-Drive Alert",
                    "You have been idling for 2 minutes. Please turn off your engine to reduce emissions and save fuel.",
                  );
                }, 120000);
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
      setBlockades((prev) => {
        const exists = prev.some((b) => b._id === newBlockade._id);
        if (exists) return prev; // 🚫 prevent duplicate
        return [...prev, newBlockade];
      });
    });

    socketRef.current.on("REMOVE_BLOCKADE", (id) => {
      setBlockades((prev) => prev.filter((b) => b._id !== id));
    });

    // <-- NEW: Listen for the live ambulance -->
    socketRef.current.on("LIVE_AMBULANCE_TRACKING", (locationData) => {
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

  useEffect(() => {
    if (uiAlert && (!uiAlert.actions || uiAlert.actions.length === 0)) {
      const timer = setTimeout(() => setUiAlert(null), 5000); // 🚨 Auto-close after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [uiAlert]);

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

      if (dist < 500) {
        console.log(
          `[RADAR] Hazard in range! Dist: ${dist}m, Depth: ${report.depth}, ID: ${report._id}`,
        );

        // Only show global pill for critical hazards
        if (report.depth === "Knee" || report.depth === "Waist") {
          triggeredAlert = `🌊 HAZARD: Severe Waterlogging Ahead (${Math.round(dist)}m)`;
        }

        // --- Task 14: Proximity Ping Logic ---
        if (!promptedHazards.current.has(report._id) && !justReported) {
          console.log(
            `[RADAR] Prompting for status update for hazard: ${report._id}`,
          );
          promptedHazards.current.add(report._id);
          showCenterAlert(
            "🌊 Waterlogging Detected",
            "Is this area still flooded?",
            [
              {
                text: "No",
                onPress: () => {
                  console.log(`[RADAR] User reported NO for ${report._id}`);
                  socketRef.current.emit("VERIFY_HYDRO_REPORT", {
                    reportId: report._id,
                    isStillThere: false,
                  });
                  setCenterAlert(null);
                },
              },
              {
                text: "Yes",
                onPress: () => {
                  console.log(`[RADAR] User reported YES for ${report._id}`);
                  socketRef.current.emit("VERIFY_HYDRO_REPORT", {
                    reportId: report._id,
                    isStillThere: true,
                  });
                  setCenterAlert(null);
                },
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
          triggeredAlert = `🚧 Construction Blockade Ahead (${Math.round(
            dist,
          )}m)`;
          break;
        }
      }
    }

    if (triggeredAlert && triggeredAlert !== activeHazardAlert) {
      const type = triggeredAlert.includes("Waterlogging")
        ? "waterlogging"
        : "blockade";
      const now = Date.now();

      if (now - hazardCooldowns.current[type] > 60000) {
        setActiveHazardAlert(triggeredAlert);
        // 🚨 Auto-close hazard alerts after 10 seconds (for both blockades and floods)
        if (
          triggeredAlert.includes("Blockade") ||
          triggeredAlert.includes("Waterlogging")
        ) {
          setTimeout(() => {
            hazardCooldowns.current[type] = Date.now(); // 🚨 Mark dismissal time
            setActiveHazardAlert(null);
          }, 10000); // 10 seconds per your latest request
        }
      }
    } else if (!triggeredAlert && activeHazardAlert) {
      setActiveHazardAlert(null);
    }
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
      // 🚨 Suppression Flag: Prevent instant verification prompt
      setJustReported(true);
      setTimeout(() => setJustReported(false), 5000);
    }
    setReportModalVisible(false);
    setSelectedCoordinate(null);
  };

  const fetchOSRMRoute = async (start, end) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&alternatives=true`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== "Ok") return null;

      const primary = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));

      const alternative = data.routes[1]
        ? data.routes[1].geometry.coordinates.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }))
        : null;

      return { primary, alternative };
    } catch (err) {
      console.log("OSRM failed:", err);
      return null;
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentLocation) return;
    Keyboard.dismiss();

    try {
      let optimizedQuery = searchQuery;
      const lowerQuery = optimizedQuery.toLowerCase();

      if (!lowerQuery.includes("ahmedabad")) {
        optimizedQuery = `${searchQuery}, Ahmedabad, Gujarat, India`;
      } else if (!lowerQuery.includes("india")) {
        optimizedQuery = `${searchQuery}, India`;
      }

      console.log(`[HYPER-LOCAL GEOCODER] Searching for: ${optimizedQuery}`);

      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(optimizedQuery)}&countrycodes=in&viewbox=72.45,23.15,72.75,22.90&bounded=1&limit=1`;

      const geoRes = await fetch(geocodeUrl, {
        headers: {
          "User-Agent": "RoadPulse-Capstone-App/1.0 (Student Project)",
          Accept: "application/json",
        },
      });
      const geoData = await geoRes.json();

      if (geoData && geoData.length > 0) {
        let destLat = parseFloat(geoData[0].lat);
        let destLng = parseFloat(geoData[0].lon);
        let displayName = geoData[0].display_name.split(",")[0]; // Grab just the local name
        setDestination({ latitude: destLat, longitude: destLng });

        console.log(
          `[ROUTING] Generating simulated algorithmic path to ${displayName}...`,
        );

        console.log("🧠 Using OSRM for citizen routing");

        const routes = await fetchOSRMRoute(currentLocation, {
          latitude: destLat,
          longitude: destLng,
        });

        if (!routes) {
          showCenterAlert("Error", "Could not calculate route");
          return;
        }

        const { primary, alternative } = routes;

        let hazardFound = false;
        let hazardType = "";
        let foundBlockade = null;
        let foundHydro = null;

        // 🔍 CHECK PRIMARY ROUTE FOR HAZARDS
        for (const point of primary) {
          // 🌊 WATER HAZARDS
          for (const report of hydroReports) {
            const hydroLat = report.location?.coordinates?.[1];
            const hydroLng = report.location?.coordinates?.[0];

            if (!hydroLat || !hydroLng) continue;

            const dist = calculateDistance(
              point.latitude,
              point.longitude,
              hydroLat,
              hydroLng,
            );

            if (dist < 150) {
              // realistic detection
              hazardFound = true;
              foundHydro = report;
              hazardType = "water";
              break;
            }
          }

          if (hazardFound) break;

          // 🚧 BLOCKADES
          for (const blockade of blockades) {
            const bLat = blockade.location.coordinates[0][0][1];
            const bLng = blockade.location.coordinates[0][0][0];

            const dist = calculateDistance(
              point.latitude,
              point.longitude,
              bLat,
              bLng,
            );

            if (dist < 150) {
              hazardFound = true;
              foundBlockade = blockade;
              hazardType = "blockade";
              break;
            }
          }

          if (hazardFound) break;
        }

        // 🎯 FINAL DECISION (ROUTING + UI)

        if (!hazardFound) {
          console.log("🟢 Route SAFE");

          setRoutePoints(primary);
          setAltRoutePoints([]);

          setUiAlert({
            title: "Route Clear",
            message: `No hazards detected towards ${displayName}`,
            type: "ROUTE_CLEAR",
          });
        } else {
          console.log("🚧 Route BLOCKED");

          // 🌊 WATER ALERT
          if (hazardType === "water" && foundHydro) {
            let time = "Unknown";

            if (foundHydro.depth === "Ankle") time = "45 minutes";
            if (foundHydro.depth === "Knee") time = "3 hours";
            if (foundHydro.depth === "Waist") time = "6 hours";

            showCenterAlert(
              "🌊 Water Logging Detected",
              `Depth: ${foundHydro.depth}\nClearance: ${time}`,
            );
          }
          // 🚧 BLOCKADE ALERT
          else if (hazardType === "blockade" && foundBlockade) {
            showCenterAlert(
              "🚧 Road Blocked",
              `Reason: ${foundBlockade.reason}\nClearance: ${foundBlockade.days} days`,
            );
          }

          // 🔁 ROUTING DECISION
          if (alternative) {
            console.log("🔁 Alternative route available");

            setRoutePoints(primary); // show blocked route first
            setAltRoutePoints(alternative); // show alt route (orange)
          } else {
            console.log("❌ No alternative route");

            setRoutePoints(primary);
            setAltRoutePoints([]);
          }
        }

        setSearchQuery("");
      } else {
        showCenterAlert(
          "📍 Location Not Found",
          "Could not find that exact location in Ahmedabad. Try using a nearby landmark.",
        );
      }
    } catch (error) {
      console.error("[OPEN-SOURCE ENGINE ERROR]", error.message);

      showCenterAlert("Network Error", "Could not reach the routing servers.");
    }
  }; 

  const handleAICommand = async () => {
    if (!aiText.trim() || !currentLocation) return;

    try {
      console.log("🧠 Sending to Gemini...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`;

      const promptText = `You are a hazard parsing AI. The user will report a flood. Extract the depth as either 'Ankle', 'Knee', or 'Waist'. If unsure, default to 'Ankle'. Return strictly valid JSON with a single key 'depth'. Example: {"depth": "Waist"}. User text: ${aiText}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      });

      const data = await response.json();

      // Failsafe: Catch Gemini API errors (e.g., bad API key)
      if (data.error) {
        console.error("[GEMINI ERROR]", data.error);
        showCenterAlert(
          "API Error",
          data.error.message || "Failed to reach AI.",
        );
        return;
      }

      const rawText = data.candidates[0].content.parts[0].text;
      const cleanedText = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsedData = JSON.parse(cleanedText);

      if (socketRef.current) {
        socketRef.current.emit("ADD_HYDRO_REPORT", {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          depth: parsedData.depth,
        });
        showCenterAlert(
          "🤖 AI Agent",
          `Hazard recognized. ${parsedData.depth}-deep flood reported at your location.`,
          [],
          {
            coords: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            },
          },
        );
        // 🚨 Suppression Flag: Prevent instant verification prompt
        setJustReported(true);
        setTimeout(() => setJustReported(false), 5000);
      }
      setAiText("");
    } catch (error) {
      console.error("[AI PARSING ERROR]", error);
      setUiAlert({
        title: "AI Error",
        message: "AI service temporarily unavailable",
        type: "AI_ERROR",
      });
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
        showsMyLocationButton={false}
        customMapStyle={isDark ? darkMapStyle : []}
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

        {routePoints.length > 0 && (
          <Polyline
            coordinates={routePoints}
            strokeColor="#007bff"
            strokeWidth={4}
          />
        )}

        {altRoutePoints.length > 0 && (
          <Polyline
            coordinates={altRoutePoints}
            strokeColor="#ff9900"
            strokeWidth={4}
          />
        )}
      </MapView>
      {centerAlert && (
        <View style={styles.centerOverlay}>
          {/* Conditional Rendering for Hazard vs Generic Alert */}
          {centerAlert.title.toLowerCase().includes("error") ? (
            <View style={styles.errorCard}>
              <View style={styles.errorIconContainer}>
                <View style={styles.errorIconCircle}>
                  <MaterialCommunityIcons name="alert" size={30} color="#FFF" />
                </View>
              </View>
              <View style={styles.errorContent}>
                <Text style={styles.errorTitle}>SERVICE UNAVAILABLE</Text>
                <Text style={styles.errorDescription}>
                  {centerAlert.message}
                </Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    if (altRoutePoints.length > 0) {
                      setRoutePoints(altRoutePoints);
                      setAltRoutePoints([]);
                    }
                    setCenterAlert(null);
                  }}
                >
                  <Text style={styles.retryBtnText}>RETRY</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : centerAlert.title.includes("AI Agent") ? (
            <View style={styles.aiAgentCard}>
              <View style={styles.aiIconWrapper}>
                <View style={styles.aiIconCircle}>
                  <MaterialCommunityIcons name="robot" size={32} color="#FFF" />
                </View>
              </View>

              <Text style={styles.aiAgentTitle}>AI Agent</Text>

              <View style={styles.aiMessageContainer}>
                <Text style={styles.aiMessageText}>
                  {"Hazard recognized. "}
                  <Text style={{ fontWeight: "bold", color: "#FFF" }}>
                    {centerAlert.message.match(/(\w+)-deep/)?.[0] || ""}
                  </Text>
                  {centerAlert.message.split(
                    centerAlert.message.match(/(\w+)-deep/)?.[0] || "",
                  )[1] || ""}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.aiPrimaryBtn}
                activeOpacity={0.8}
                onPress={() => {
                  const targetCoords =
                    centerAlert.metadata?.coords || currentLocation;
                  if (targetCoords) {
                    setMapRegion({
                      latitude: targetCoords.latitude,
                      longitude: targetCoords.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    });
                  }
                  setCenterAlert(null);
                  setShowControls(false); // Close bottom panel for better view
                }}
              >
                <Text style={styles.aiPrimaryBtnText}>View on Map</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.aiSecondaryBtn}
                onPress={() => setCenterAlert(null)}
              >
                <Text style={styles.aiSecondaryBtnText}>Dismiss</Text>
              </TouchableOpacity>

              <Text style={styles.aiBottomTagline}>ACTIVE FLOOD ZONE</Text>
            </View>
          ) : centerAlert.title.includes("Road Blocked") ||
            centerAlert.title.includes("Blockade") ||
            centerAlert.title.includes("Water Logging") ? (
            <View style={styles.blockadeCard}>
              <View style={styles.blockadeHeader}>
                <View
                  style={[
                    styles.blockadeIconBox,
                    centerAlert.title.includes("Water") && {
                      backgroundColor: "#1A3A5F",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      centerAlert.title.includes("Water")
                        ? "waves"
                        : "hammer-wrench"
                    }
                    size={28}
                    color={
                      centerAlert.title.includes("Water")
                        ? "#5D9CFF"
                        : "#FF6B6B"
                    }
                  />
                </View>
                <View style={styles.blockadeHeaderText}>
                  <Text style={styles.blockadeTagline}>CONTEXTUAL ALERT</Text>
                  <Text style={styles.blockadeTitle}>
                    {centerAlert.title.includes("Water")
                      ? "Waterlogging"
                      : "Road Blocked"}
                  </Text>
                </View>
              </View>

              <View style={styles.blockadeSection}>
                <Text style={styles.blockadeLabel}>REASON</Text>
                <Text style={styles.blockadeValue}>
                  {centerAlert.message.split("\n")[0].split(": ")[1] ||
                    "Unknown hazard"}
                </Text>
              </View>

              <View style={styles.clearanceCapsule}>
                <MaterialCommunityIcons
                  name="timer-outline"
                  size={18}
                  color="#8E8E93"
                />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.clearanceLabel}>EST. CLEARANCE</Text>
                  <Text style={styles.clearanceValue}>
                    {centerAlert.message.split("\n")[1]?.split(": ")[1] ||
                      "Unknown"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.alternateRouteBtn}
                onPress={() => setCenterAlert(null)}
              >
                <Text style={styles.alternateRouteBtnText}>
                  View Alternate Route
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissTextBtn}
                onPress={() => setCenterAlert(null)}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : centerAlert.title.includes("Waterlogging") ? (
            <View style={styles.hazardCard}>
              <View style={styles.hazardHeader}>
                <View style={styles.hazardIconBox}>
                  <MaterialCommunityIcons
                    name="waves"
                    size={32}
                    color="#5D9CFF"
                  />
                </View>
                <View style={styles.hazardTextContainer}>
                  <Text style={styles.hazardTitle}>Waterlogging Detected</Text>
                  <Text style={styles.hazardSubtitle}>
                    {centerAlert.message}
                  </Text>
                </View>
              </View>

              <View style={styles.hazardButtonRow}>
                {centerAlert.actions?.map((btn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.hazardBtn,
                      btn.text === "Yes"
                        ? styles.hazardBtnYes
                        : styles.hazardBtnNo,
                    ]}
                    onPress={btn.onPress}
                  >
                    <Text style={styles.hazardBtnText}>{btn.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.centerCard}>
              <Text style={styles.centerTitle}>{centerAlert.title}</Text>
              <Text style={styles.centerText}>{centerAlert.message}</Text>

              {/* BUTTONS */}
              {centerAlert.actions?.length > 0 ? (
                <View style={{ flexDirection: "row", marginTop: 15, gap: 10 }}>
                  {centerAlert.actions.map((btn, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.centerBtn}
                      onPress={btn.onPress}
                    >
                      <Text style={{ color: "#fff" }}>{btn.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.centerBtn, { marginTop: 15 }]}
                  onPress={() => setCenterAlert(null)}
                >
                  <Text style={{ color: "#fff" }}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* --- PREMIUM UI OVERLAYS --- */}

      {/* 1. Top Floating Header */}
      <View style={styles.premiumHeader}>
        <TouchableOpacity style={styles.headerIconButton}>
          <Ionicons name="person" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerMainTitle}>Citizen Dashboard</Text>
          <Text style={styles.headerStatusText}>LIVE TRAFFIC & BLOCKADES</Text>
        </View>
      </View>

      {/* 🚨 Active Hazard Global Alert (NEW/RESTORED) */}
      {/* 🚨 ALERT STACK (Notifications below Search Capsule) */}
      <View style={styles.alertStackContainer}>
        {/* 1. Route Clear Toast */}
        {uiAlert && uiAlert.type === "ROUTE_CLEAR" && (
          <TouchableOpacity
            style={styles.routeClearToastStack}
            activeOpacity={0.8}
            onPress={() => setUiAlert(null)}
          >
            <View style={styles.toastIconCircle}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color="#2ecc71"
              />
            </View>
            <View style={styles.toastTextContent}>
              <Text style={styles.toastTitleText}>{uiAlert.title}</Text>
              <Text style={styles.toastSubtitleText}>{uiAlert.message}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 2. Orange Blockade Alert */}
        {activeHazardAlert && activeHazardAlert.includes("Blockade") && (
          <TouchableOpacity
            style={styles.blockadePill}
            onPress={() => {
              hazardCooldowns.current.blockade = Date.now(); // 🚨 Record manual dismissal
              setActiveHazardAlert(null);
            }}
          >
            <Text style={styles.blockadeText}>
              {activeHazardAlert.replace("🚧 HAZARD: ", "")}
            </Text>
          </TouchableOpacity>
        )}

        {/* 3. Red/Pink Hazard Alert (Waterlogging) */}
        {activeHazardAlert && activeHazardAlert.includes("Waterlogging") && (
          <TouchableOpacity
            style={styles.hazardPillPremium}
            onPress={() => {
              hazardCooldowns.current.waterlogging = Date.now(); // 🚨 Record manual dismissal
              setActiveHazardAlert(null);
            }}
          >
            <MaterialCommunityIcons
              name="waves"
              size={30}
              color="#700F0A"
              style={{ marginLeft: 5 }}
            />
            <View style={styles.hazardPillTextContainer}>
              <Text style={styles.hazardPillTitle}>
                Severe Waterlogging Ahead
              </Text>
              <Text style={styles.hazardPillSubtitle}>
                FLASH FLOOD WARNING • CURRENT ROUTE
              </Text>
            </View>
            <View style={styles.hazardDistanceStack}>
              <Text style={styles.hazardDistanceText}>
                {activeHazardAlert.match(/\((\d+m)\)/)?.[1] || "50m"}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 4. AI Error Toast */}
        {uiAlert && uiAlert.type === "AI_ERROR" && (
          <TouchableOpacity
            style={styles.aiErrorToast}
            onPress={() => setUiAlert(null)}
          >
            <View style={styles.aiErrorAccent} />
            <MaterialCommunityIcons
              name="alert"
              size={20}
              color="#FF4D4D"
              style={{ marginHorizontal: 12 }}
            />
            <Text style={styles.aiErrorText}>{uiAlert.message}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Floating Search/Report Capsule */}
      <TouchableOpacity
        style={styles.searchCapsule}
        activeOpacity={0.9}
        onPress={() => setShowControls(!showControls)}
      >
        <View style={styles.searchCapsuleContent}>
          <Ionicons name="compass" size={20} color="#FFF" />
          <Text style={styles.searchCapsuleText}>Search or Report</Text>
        </View>
      </TouchableOpacity>

      {/* 4. Collapsible Bottom Panel */}
      {showControls && (
        <View style={styles.bottomPanelContainer}>
          <View style={styles.panelHandle} />

          {/* Action Buttons Row */}
          <View style={styles.panelActionsRow}>
            <TouchableOpacity
              style={[
                styles.panelActionButton,
                panelMode === "navigate" && { backgroundColor: "#5D9CFF" },
              ]}
              onPress={() => setPanelMode("navigate")}
            >
              <Ionicons
                name="navigate"
                size={20}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.panelActionText}>Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.panelActionButton,
                panelMode === "report" && { backgroundColor: "#FF6B6B" },
              ]}
              onPress={() => setPanelMode("report")}
            >
              <Ionicons
                name="warning"
                size={20}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.panelActionText}>Report Hazard</Text>
            </TouchableOpacity>
          </View>

          {/* Conditional Input Section */}
          {panelMode === "navigate" ? (
            <View style={styles.panelSearchContainer}>
              <Ionicons name="search" size={20} color="#888" />
              <TextInput
                style={styles.panelSearchInput}
                placeholder="Where to?"
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity onPress={handleSearch}>
                <Ionicons name="arrow-forward" size={20} color="#8A8AFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.panelSearchContainer}>
              <Ionicons name="mic" size={18} color="#888" />
              <TextInput
                style={styles.panelSearchInput}
                placeholder="AI command (e.g. report flood)..."
                placeholderTextColor="#888"
                value={aiText}
                onChangeText={setAiText}
              />
              <TouchableOpacity
                style={styles.aiSendSmall}
                onPress={handleAICommand}
              >
                <Ionicons name="send" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 🚨 AMBULANCE VANGUARD: PREMIUM EMERGENCY DASHBOARD */}
      {isEmergency && (
        <>
          {/* Top Proximity Alert Card */}
          <View style={styles.vanguardHeaderCard}>
            <View style={styles.vanguardIconBox}>
              <View style={styles.vanguardIconCircle}>
                <MaterialCommunityIcons name="alert" size={32} color="#FFF" />
              </View>
            </View>
            <View style={styles.vanguardTextContent}>
              <Text style={styles.vanguardTitle}>
                AMBULANCE {` \n`}APPROACHING
              </Text>
              <Text style={styles.vanguardDistance}>
                Yield immediately •{" "}
                <Text style={{ fontWeight: "900", color: "#FFF" }}>
                  {ambulanceLocation && currentLocation
                    ? `${Math.round(calculateDistance(currentLocation.latitude, currentLocation.longitude, ambulanceLocation.latitude, ambulanceLocation.longitude))}m`
                    : "Nearby"}
                </Text>{" "}
                away
              </Text>
            </View>
          </View>

          {/* Bottom Safety Protocol Dashboard */}
          <View style={styles.safetyProtocolCard}>
            <View style={styles.protocolHeader}>
              <View style={styles.protocolTitleRow}>
                <Text style={styles.protocolTitle}>Safety Protocol</Text>
                <View style={styles.liveAlertBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveAlertText}>LIVE ALERT</Text>
                </View>
              </View>
              <Text style={styles.protocolSubtitle}>
                Critical instructions for current route
              </Text>
            </View>

            <View style={styles.protocolGrid}>
              <View style={styles.protocolTile}>
                <View style={styles.protocolIconCircle}>
                  <MaterialCommunityIcons
                    name="arrow-bottom-left-thick"
                    size={24}
                    color="#A5C8FF"
                  />
                </View>
                <Text style={styles.protocolTileText}>
                  Move to{` \n`}left lane
                </Text>
              </View>

              <View style={styles.protocolTile}>
                <View style={styles.protocolIconCircle}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={24}
                    color="#FF6B6B"
                  />
                </View>
                <Text style={styles.protocolTileText}>
                  Avoid{` \n`}intersections
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* 📝 Hazard Reporting Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setReportModalVisible(false)}
          />
          <View style={styles.premiumReportModal}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.premiumModalTitle}>Report Waterlogging</Text>
              <Text style={styles.premiumModalSubtitle}>
                How deep is the water here?
              </Text>
            </View>

            <View style={styles.reportOptionsContainer}>
              {/* ANKLE DEEP */}
              <TouchableOpacity
                style={styles.depthCardAnkle}
                onPress={() => submitHydroReport("Ankle")}
              >
                <View
                  style={[
                    styles.depthIconCircle,
                    { backgroundColor: "rgba(255,255,255,0.1)" },
                  ]}
                >
                  <MaterialCommunityIcons name="water" size={24} color="#FFF" />
                </View>
                <View style={styles.depthTextContainer}>
                  <Text style={styles.depthTitle}>Ankle Deep</Text>
                  <Text style={styles.depthSubtitle}>
                    Minor pooling, passable
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="rgba(255,255,255,0.3)"
                />
              </TouchableOpacity>

              {/* KNEE DEEP */}
              <TouchableOpacity
                style={styles.depthCardKnee}
                onPress={() => submitHydroReport("Knee")}
              >
                <View
                  style={[
                    styles.depthIconCircle,
                    { backgroundColor: "rgba(0,0,0,0.15)" },
                  ]}
                >
                  <MaterialCommunityIcons name="waves" size={24} color="#FFF" />
                </View>
                <View style={styles.depthTextContainer}>
                  <Text style={styles.depthTitle}>Knee Deep</Text>
                  <Text style={styles.depthSubtitle}>
                    Significant flow, difficult
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="rgba(0,0,0,0.2)"
                />
              </TouchableOpacity>

              {/* WAIST DEEP */}
              <TouchableOpacity
                style={styles.depthCardWaist}
                onPress={() => submitHydroReport("Waist")}
              >
                <View
                  style={[
                    styles.depthIconCircle,
                    { backgroundColor: "rgba(255,255,255,0.2)" },
                  ]}
                >
                  <MaterialCommunityIcons name="alert" size={24} color="#FFF" />
                </View>
                <View style={styles.depthTextContainer}>
                  <Text style={[styles.depthTitle, { fontWeight: "900" }]}>
                    WAIST DEEP (DANGER)
                  </Text>
                  <Text
                    style={[
                      styles.depthSubtitle,
                      { color: "rgba(255,255,255,0.8)" },
                    ]}
                  >
                    Life threatening, do not cross
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="exclamation-thick"
                  size={22}
                  color="rgba(255,255,255,0.5)"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.premiumCancelBtn}
              onPress={() => setReportModalVisible(false)}
            >
              <Text style={styles.premiumCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // --- NEW PREMIUM UI STYLES ---
  premiumHeader: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: "#1E222A",
    borderRadius: 35,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 20,
  },
  headerIconButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#2A2F3A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerMainTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  headerStatusText: {
    color: "#8A91A0",
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
  searchCapsule: {
    position: "absolute",
    top: 135,
    alignSelf: "center",
    width: 220,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#5D9CFF", // Premium blue
    justifyContent: "center",
    alignItems: "center",
    zIndex: 90,
    shadowColor: "#5D9CFF",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  searchCapsuleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchCapsuleText: {
    color: "#FFF",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 14,
  },
  bottomPanelContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1C1F26",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    padding: 20,
    paddingBottom: 50, // space for bottom nav
    zIndex: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  panelHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#3A3F4B",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  panelActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  panelActionButton: {
    flex: 0.48,
    height: 70,
    backgroundColor: "#252932",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },

  panelActionText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  panelSearchContainer: {
    height: 55,
    backgroundColor: "#252932",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 0,
  },
  panelSearchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    marginLeft: 10,
  },
  aiSendSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2ecc71",
    justifyContent: "center",
    alignItems: "center",
  },
  shortcutsScroll: {
    marginTop: 20,
  },
  shortcutPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252932",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#3A3F4B",
  },
  shortcutText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomNavPill: {
    position: "absolute",
    bottom: 25,
    alignSelf: "center",
    width: 200,
    height: 65,
    backgroundColor: "#1C1F26",
    borderRadius: 32.5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    zIndex: 300,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: "#2A2F3A",
  },
  navItem: {
    flex: 1,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  container: { flex: 1, backgroundColor: "#121212" },
  map: { ...StyleSheet.absoluteFillObject },
  // --- AMBULANCE VANGUARD: GUARDIAN DASHBOARD STYLES ---
  vanguardHeaderCard: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#C9443A", // Premium Red/Coral
    borderRadius: 36,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  vanguardIconBox: {
    marginRight: 20,
  },
  vanguardIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  vanguardTextContent: {
    flex: 1,
  },
  vanguardTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 4,
    lineHeight: 28,
  },
  vanguardDistance: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "600",
  },
  safetyProtocolCard: {
    position: "absolute",
    bottom: 30, // Above bottom panel toggle
    left: 20,
    right: 20,
    backgroundColor: "rgba(28, 31, 38, 0.98)",
    borderRadius: 40,
    padding: 24,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 25,
  },
  protocolHeader: {
    marginBottom: 20,
  },
  protocolTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  protocolTitle: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "800",
  },
  liveAlertBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(165, 200, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A5C8FF",
    marginRight: 8,
  },
  liveAlertText: {
    color: "#A5C8FF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  protocolSubtitle: {
    color: "#8E8E93",
    fontSize: 14,
    fontWeight: "500",
  },
  protocolGrid: {
    flexDirection: "row",
    gap: 12,
  },
  protocolTile: {
    flex: 1,
    backgroundColor: "#252B35",
    borderRadius: 24,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  protocolIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  protocolTileText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
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
  hydroEmoji: { fontSize: 15 },
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
  modalHeader: { marginBottom: 20, alignItems: "center" },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },
  modalSubtitle: { color: "#aaa", fontSize: 16 },
  modalOptions: { gap: 12 },
  depthBtn: { padding: 16, borderRadius: 15, alignItems: "center" },
  depthBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  cancelBtn: { padding: 16, alignItems: "center", marginTop: 5 },
  cancelBtnText: { color: "#ff3b30", fontSize: 16, fontWeight: "bold" },

  // --- NEW PREMIUM REPORT MODAL STYLES ---
  premiumReportModal: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 24,
    paddingBottom: 40,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#3A3A3C",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  premiumModalTitle: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  premiumModalSubtitle: {
    color: "#8E8E93",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
  },
  reportOptionsContainer: {
    gap: 16,
    marginBottom: 30,
  },
  depthCardAnkle: {
    backgroundColor: "#2C2C2E",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  depthCardKnee: {
    backgroundColor: "#4294FF",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    shadowColor: "#4294FF",
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  depthCardWaist: {
    backgroundColor: "#EB4D3D",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    shadowColor: "#EB4D3D",
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  depthIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  depthTextContainer: {
    flex: 1,
  },
  depthTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 2,
  },
  depthSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  premiumCancelBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  premiumCancelText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
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
  trafficLightCircle: { width: 14, height: 14, borderRadius: 7 },
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
  closeBtn: { position: "absolute", top: 10, right: 10 },
  alertWarning: { color: "orange", marginTop: 8, fontWeight: "bold" },
  alertStack: {
    position: "absolute",
    top: 130, // Below the header
    left: 20,
    right: 20,
    zIndex: 99,
    gap: 10,
  },
  centerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },
  centerCard: {
    width: "85%",
    backgroundColor: "#1E222A",
    borderRadius: 30,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3F4B",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  centerTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  centerText: {
    color: "#A0A7B5",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 5,
  },
  centerBtn: {
    backgroundColor: "#5D9CFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 15,
    minWidth: 100,
    alignItems: "center",
    marginTop: 10,
  },
  actionCard: {
    backgroundColor: "#1c1c1e",
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderColor: "#f39c12",
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  // --- NEW HAZARD UI STYLES ---
  hazardCard: {
    width: "90%",
    backgroundColor: "#1C1C1E",
    borderRadius: 36,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  hazardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  hazardIconBox: {
    width: 60,
    height: 60,
    backgroundColor: "#2C1E1E", // Dark reddish background
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  hazardTextContainer: {
    flex: 1,
  },
  hazardTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  hazardSubtitle: {
    color: "#A0A7B5",
    fontSize: 16,
    lineHeight: 22,
  },
  hazardButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  hazardBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  hazardBtnYes: {
    backgroundColor: "#FF453A", // iOS Red
  },
  hazardBtnNo: {
    backgroundColor: "#2C2C2E", // iOS Dark Grey
  },
  hazardBtnText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  locationFAB: {
    position: "absolute",
    bottom: 120, // Above bottom panel
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#A5C8FF", // Premium light blue
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 150,
  },
  // --- NEW ROUTE CLEAR TOAST STYLES ---
  routeClearToast: {
    position: "absolute",
    top: 195, // Positioned after Search Capsule (135+48+base)
    left: 20,
    right: 20,
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 95,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  toastIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(46, 204, 113, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  toastTextContent: {
    flex: 1,
  },
  toastTitleText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  toastSubtitleText: {
    color: "#8E8E93",
    fontSize: 14,
    marginTop: 2,
  },
  alertStackContainer: {
    position: "absolute",
    top: 195, // Below Search Capsule
    left: 20,
    right: 20,
    zIndex: 200,
    gap: 12,
  },
  routeClearToastStack: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  blockadePill: {
    backgroundColor: "#2C1E0A", // Dark orange/brown background
    borderRadius: 24,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#F39C12",
    alignSelf: "center",
    shadowColor: "#F39C12",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  blockadeText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  hazardPillPremium: {
    backgroundColor: "#E5A49B", // Light red/pinkish background
    borderRadius: 50,
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "rgba(112, 15, 10, 0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  hazardPillTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  hazardPillTitle: {
    color: "#700F0A", // Dark red text
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 2,
  },
  hazardPillSubtitle: {
    color: "#700F0A",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  hazardDistanceStack: {
    backgroundColor: "#700F0A", // Dark red pill
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  hazardDistanceText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 14,
  },
  // --- PREMIUM ERROR UI STYLES ---
  errorCard: {
    backgroundColor: "#2C1B1B", // Dark red/burgundy
    width: "90%",
    borderRadius: 32,
    padding: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.1)",
  },
  errorIconContainer: {
    marginRight: 16,
  },
  errorIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  errorDescription: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: "#E32F2F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  retryBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
  },
  aiErrorToast: {
    backgroundColor: "#2A2A2E",
    borderRadius: 24,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  aiErrorAccent: {
    width: 6,
    height: "100%",
    backgroundColor: "#FF3B30",
  },
  aiErrorText: {
    color: "#E5E5E5",
    fontSize: 14,
    fontWeight: "500",
  },
  // --- PREMIUM AI AGENT UI STYLES ---
  aiAgentCard: {
    backgroundColor: "#1C1C1E",
    width: "85%",
    borderRadius: 36,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 25,
  },
  aiIconWrapper: {
    marginBottom: 16,
    shadowColor: "#5D9CFF",
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  aiIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2C3E50",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(93, 156, 255, 0.3)",
  },
  aiAgentTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  aiMessageContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    width: "100%",
  },
  aiMessageText: {
    color: "#E5E5E5",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  aiPrimaryBtn: {
    backgroundColor: "#5D9CFF",
    width: "100%",
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#5D9CFF",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  aiPrimaryBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  aiSecondaryBtn: {
    paddingVertical: 8,
    marginBottom: 12,
  },
  aiSecondaryBtnText: {
    color: "#8E8E93",
    fontSize: 15,
    fontWeight: "600",
  },
  aiBottomTagline: {
    color: "#FF4D4D",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    opacity: 0.6,
  },
  // --- PREMIUM BLOCKAGE DETAILS STYLES ---
  blockadeCard: {
    backgroundColor: "#2C2C2E",
    width: "85%",
    borderRadius: 32,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  blockadeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  blockadeIconBox: {
    width: 60,
    height: 60,
    backgroundColor: "#3D2424", // Dark red background for construction
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  blockadeHeaderText: {
    flex: 1,
  },
  blockadeTagline: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  blockadeTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  blockadeSection: {
    marginBottom: 20,
  },
  blockadeLabel: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  blockadeValue: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "500",
  },
  clearanceCapsule: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  clearanceLabel: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  clearanceValue: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  alternateRouteBtn: {
    backgroundColor: "#5D9CFF",
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#5D9CFF",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  alternateRouteBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  dismissTextBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dismissText: {
    color: "#8E8E93",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default CitizenMap;
