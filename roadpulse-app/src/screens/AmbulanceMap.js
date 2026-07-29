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
import MapView, {
  Polygon,
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
} from "react-native-maps";
import * as Location from "expo-location";
import io from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const AmbulanceMap = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const [blockades, setBlockades] = useState([]);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [intersections, setIntersections] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [aiCommand, setAiCommand] = useState("");
  const [destination, setDestination] = useState("");
  const [routePoints, setRoutePoints] = useState([]);
  const [routeAlert, setRouteAlert] = useState(null);
  const [centerAlert, setCenterAlert] = useState(null);
  const [hydroReports, setHydroReports] = useState([]);

  const showCenterAlert = (title, message, actions = []) => {
    console.log(`🔔 [CENTER ALERT] ${title}: ${message}`);
    setCenterAlert({ title, message, actions });
  };
  const [altRoute, setAltRoute] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  const [mapRegion, setMapRegion] = useState({
    latitude: 23.0225,
    longitude: 72.5714,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  const socketRef = useRef(null);
  const locationSubRef = useRef(null);

  useEffect(() => {
    fetchBlockades();

    // ✅ FIRST initialize socket
    socketRef.current = io(API_URL);

    // ✅ THEN use it
    socketRef.current.on("INITIAL_HYDRO_REPORTS", (reports) => {
      console.log("🌊 Initial Hydro Reports:", reports.length);
      console.log("🌊 FULL HYDRO OBJECT:", hydroReports[0]);
      setHydroReports(reports);
    });

    socketRef.current.on("NEW_HYDRO_REPORT", (newReport) => {
      console.log("🌊 New Hydro Report received");
      setHydroReports((prev) => [...prev, newReport]);
    });

    socketRef.current.on("REMOVE_HYDRO_REPORT", (id) => {
      setHydroReports((prev) => prev.filter((r) => r._id !== id));
    });

    socketRef.current = io(API_URL);
    socketRef.current.on("NEW_ROADBLOCK", (newBlockade) => {
      setBlockades((prev) => [...prev, newBlockade]);
    });

    socketRef.current.on("INITIAL_INTERSECTIONS", (data) => {
      console.log("🚦 RECEIVED INTERSECTIONS:", data);

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
      if (locationSubRef.current) locationSubRef.current.remove();
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
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
      setIsTracking(false);
    } else {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showCenterAlert(
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
          console.log(
            `\n📍 [AMBULANCE FRONTEND] GPS hardware moved: Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`,
          );
          setAmbulanceLocation({ latitude, longitude });
          setMapRegion((prev) => ({ ...prev, latitude, longitude }));

          if (socketRef.current) {
            console.log(`📡 [AMBULANCE FRONTEND] Emitting to socket...`);
            socketRef.current.emit("AMBULANCE_LOCATION_UPDATE", {
              latitude,
              longitude,
            });
          }
        },
      );
    }
  };

  const handleAIVoiceCommand = async () => {
    if (!aiCommand.trim()) return;

    try {
      console.log("🧠 Sending to Gemini (Ambulance)...");
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`;
      const promptText = `You are an emergency vehicle AI assistant. The driver will give a command. Determine if they want to 'START' or 'STOP' their live location broadcasting. Return strictly valid JSON with a single key 'action' that is exactly 'START' or 'STOP'. Example: {"action": "START"}. User text: ${aiCommand}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      });

      const data = await response.json();
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

      if (parsedData.action === "START") {
        showCenterAlert(
          "🤖 AI Agent",
          "Understood. Initiating Live Vanguard Broadcast.",
        );
        if (!isTracking) await toggleTracking();
      } else if (parsedData.action === "STOP") {
        showCenterAlert(
          "🤖 AI Agent",
          "Understood. Terminating Live Broadcast.",
        );
        if (isTracking) await toggleTracking();
      }
      setAiCommand("");
    } catch (error) {
      console.error("[AI PARSING ERROR]", error);
      showCenterAlert("AI Error", "Failed to parse command.");
    }
  };

  const formatPolygonCoords = (geoJsonCoords) => {
    return geoJsonCoords[0].map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
    }));
  };

  const generateRoute = (start, end) => {
    const points = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const lat =
        start.latitude + (end.latitude - start.latitude) * (i / steps);
      const lng =
        start.longitude + (end.longitude - start.longitude) * (i / steps);
      points.push({ latitude: lat, longitude: lng });
    }
    return points;
  };

  const getHydroColor = (depth) => {
    switch (depth) {
      case "Ankle":
        return "#3498db"; // Light Blue
      case "Knee":
        return "#2980b9"; // Medium Blue
      case "Waist":
        return "#8e44ad"; // Danger Purple
      default:
        return "#3498db";
    }
  };

  const checkRouteForBlockages = (route) => {
    // 🔴 CHECK BLOCKADES
    for (let point of route) {
      for (let b of blockades) {
        const coords = b.location.coordinates[0];
        for (let c of coords) {
          const dist =
            Math.abs(point.latitude - c[1]) + Math.abs(point.longitude - c[0]);

          if (dist < 0.001) return { ...b, type: "blockade" };
        }
      }
    }

    for (let point of route) {
      for (let h of hydroReports) {
        const hydroLat = h.latitude || h.location?.coordinates?.[1];
        const hydroLng = h.longitude || h.location?.coordinates?.[0];

        if (!hydroLat || !hydroLng) continue;

        const R = 6371000;
        const dLat = ((hydroLat - point.latitude) * Math.PI) / 180;
        const dLon = ((hydroLng - point.longitude) * Math.PI) / 180;

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((point.latitude * Math.PI) / 180) *
            Math.cos((hydroLat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance < 150) {
          console.log("🌊 Water hazard detected at:", distance);

          return {
            ...h,
            type: "water",
            reason: `Water Logging (${h.depth})`,
            days: 1,
          };
        }
      }
    }

    return null;
  };

  const fetchOSRMRoute = async (start, end) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&alternatives=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No routes found");
      }

      const formatCoords = (coords) =>
        coords.map((c) => ({
          latitude: c[1],
          longitude: c[0],
        }));

      return {
        primary: formatCoords(data.routes[0].geometry.coordinates),
        alternative:
          data.routes.length > 1
            ? formatCoords(data.routes[1].geometry.coordinates)
            : null,
      };
    } catch (error) {
      console.log("OSRM Routing Error:", error);
      return null;
    }
  };

  const geocodeDestination = async (query) => {
    try {
      console.log("🔍 Geocoding:", query);

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + " Gujarat")}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "AmbulanceApp/1.0 (your@email.com)",
          Accept: "application/json",
        },
      });

      const text = await res.text(); // 👈 important for debugging

      console.log("🌐 Raw response:", text.substring(0, 100));

      const data = JSON.parse(text); // 👈 safer now

      if (!data || data.length === 0) {
        throw new Error("No location found");
      }

      const location = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };

      console.log("📍 Geocoded Result:", location);

      return location;
    } catch (err) {
      console.log("❌ Geocoding failed:", err);
      showCenterAlert("Search Error", "Could not find destination");
      return null;
    }
  };

  const handleNavigation = async () => {
    if (!ambulanceLocation) {
      showCenterAlert(
        "Location not ready",
        "GPS signal required for mission routing.",
      );
      return;
    }

    if (!destination.trim()) {
      showCenterAlert("Missing Destination", "Please enter a destination.");
      return;
    }

    console.log("🚀 Starting Navigation");

    // ✅ Step 1: Convert text → coordinates
    const destinationCoords = await geocodeDestination(destination);
    if (!destinationCoords) return;

    console.log("📍 START:", ambulanceLocation);
    console.log("🎯 DEST:", destinationCoords);

    // ✅ Step 2: Try OSRM
    const routes = await fetchOSRMRoute(ambulanceLocation, destinationCoords);

    if (routes) {
      console.log("✅ Using OSRM route");

      const { primary } = routes;

      console.log("🛣️ Primary route points:", primary.length);

      const foundBlock = checkRouteForBlockages(primary);

      // ✅ CASE 1: SAFE → USE OSRM
      if (!foundBlock) {
        console.log("🟢 OSRM route is SAFE");

        setRoutePoints(primary);
        setAltRoute([]);
        setRouteAlert({ type: "safe" });
      } else {
        console.log("🚧 OSRM route BLOCKED → switching to fallback system");

        // ✅ USE YOUR ORIGINAL SYSTEM (NO BREAK)
        const fallbackRoute = generateRoute(
          ambulanceLocation,
          destinationCoords,
        );
        const alt = generateAltRoute(ambulanceLocation, destinationCoords);

        setRoutePoints(fallbackRoute);
        setAltRoute(alt);

        setRouteAlert({
          type: "blockade",
          reason: foundBlock.reason,
          days: foundBlock.days,
        });
      }
    } else {
      console.log("⚠️ OSRM failed → using fallback system");

      // ✅ SAME OLD SYSTEM
      const fallbackRoute = generateRoute(ambulanceLocation, destinationCoords);
      const alt = generateAltRoute(ambulanceLocation, destinationCoords);

      const foundBlock = checkRouteForBlockages(fallbackRoute);

      setRoutePoints(fallbackRoute);
      setAltRoute(alt);

      if (foundBlock) {
        setRouteAlert({
          type: "blockade",
          reason: foundBlock.reason,
          days: foundBlock.days,
        });
      } else {
        setRouteAlert({ type: "safe" });
      }
    }
  };

  // const generateAltRoute = (start, end) => {
  //   const offset = 0.003;
  //   const newEnd = {
  //     latitude: end.latitude + offset,
  //     longitude: end.longitude - offset,
  //   };
  //   return generateRoute(start, newEnd);
  // };

  const generateAltRoute = (start, end) => {
    const points = [];
    const steps = 60;

    const dx = end.longitude - start.longitude;
    const dy = end.latitude - start.latitude;

    const length = Math.sqrt(dx * dx + dy * dy);

    // perpendicular direction
    const px = -dy / length;
    const py = dx / length;

    const curveStrength = 0.008; // adjust

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // straight base
      const lat = start.latitude + dy * t;
      const lng = start.longitude + dx * t;

      // 🔥 multi-curve (S shape)
      const wave1 = Math.sin(Math.PI * t); // main curve
      const wave2 = Math.sin(3 * Math.PI * t); // extra turns
      const offset = (wave1 + 0.5 * wave2) * curveStrength;

      points.push({
        latitude: lat + py * offset,
        longitude: lng + px * offset,
      });
    }

    return points;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation={false}
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

        {hydroReports.map((report) => {
          const lat = report.location?.coordinates?.[1];
          const lng = report.location?.coordinates?.[0];

          if (!lat || !lng) return null;

          return (
            <Marker
              key={report._id}
              coordinate={{
                latitude: lat,
                longitude: lng,
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
          );
        })}

        {ambulanceLocation && (
          <Marker coordinate={ambulanceLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View
              style={[styles.ambulanceMarker, { borderColor: theme.primary }]}
            >
              <View
                style={[
                  styles.ambulanceMarkerCore,
                  { backgroundColor: theme.primary },
                ]}
              />
            </View>
          </Marker>
        )}

        {intersections.map((int) => (
          <Marker
            key={int.id}
            coordinate={{ latitude: int.lat, longitude: int.lng }}
          >
            <View
              style={[styles.trafficLightPill, { borderColor: theme.border }]}
            >
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
            strokeColor="#007AFF"
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />
        )}
        {altRoute.length > 0 && (
          <Polyline
            coordinates={altRoute}
            strokeColor="#00FF00"
            strokeWidth={5}
          />
        )}
      </MapView>

      <TouchableOpacity
        style={[styles.voiceFab, { backgroundColor: theme.primary }]}
        onPress={() => setShowVoice(!showVoice)}
      >
        <Ionicons name="mic" size={28} color="#000" />
      </TouchableOpacity>

      {routePoints.length > 0 && !routeAlert && (
        <View style={styles.dispatchOverlay}>
          <View style={[styles.dispatchCard, { backgroundColor: theme.card }]}>
            <View style={styles.dispatchHeader}>
              <View
                style={[
                  styles.dispatchIconBox,
                  { backgroundColor: "rgba(255, 59, 48, 0.15)" },
                ]}
              >
                <Ionicons name="flash" size={20} color={theme.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dispatchTitle, { color: theme.text }]}>
                  EMERGENCY DISPATCH
                </Text>
                <Text
                  style={[styles.dispatchSubtitle, { color: theme.subText }]}
                >
                  Live Routing & Interception Active
                </Text>
              </View>
              <View
                style={[
                  styles.liveIndicator,
                  { backgroundColor: isTracking ? "#34C759" : "#8E8E93" },
                ]}
              >
                <Text style={styles.liveText}>
                  {isTracking ? "LIVE" : "OFFLINE"}
                </Text>
              </View>
            </View>

            <View style={styles.dispatchDivider} />

            <View style={styles.dispatchActions}>
              <TouchableOpacity
                style={[
                  styles.trackingToggleSmall,
                  {
                    backgroundColor: isTracking
                      ? "rgba(52, 199, 89, 0.1)"
                      : "rgba(255, 255, 255, 0.05)",
                  },
                ]}
                onPress={toggleTracking}
              >
                <Ionicons
                  name={isTracking ? "radio" : "radio-outline"}
                  size={18}
                  color={isTracking ? "#34C759" : theme.subText}
                />
                <Text
                  style={[
                    styles.trackingToggleText,
                    { color: isTracking ? "#34C759" : theme.subText },
                  ]}
                >
                  {isTracking ? "Broadcasting" : "Tracking Off"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.endMissionBtn,
                  { backgroundColor: theme.danger },
                ]}
                onPress={() => {
                  setRoutePoints([]);
                  setAltRoute([]);
                  setRouteAlert(null);
                }}
              >
                <Text style={styles.endMissionText}>End Mission</Text>
                <Ionicons name="close-circle" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <SafeAreaView style={styles.overlay}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <View style={[styles.iconBox, { backgroundColor: theme.iconBg }]}>
            <Ionicons name="medical" size={24} color={theme.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Ambulance Portal
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isTracking ? "#34C759" : "#8E8E93" },
                ]}
              />
              <Text style={[styles.headerSubtitle, { color: theme.subText }]}>
                {isTracking ? "Vanguard Active" : "Tracking Paused"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              setShowSearch(!showSearch);
              if (showVoice) setShowVoice(false);
            }}
            style={[
              styles.searchButton,
              showSearch && {
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 12,
              },
            ]}
          >
            <Ionicons
              name={showSearch ? "close" : "search"}
              size={22}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>

        {showVoice && routePoints.length === 0 && (
          <View style={[styles.premiumCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="mic-circle" size={24} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Voice Assistant
              </Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.premiumInput, { color: theme.text }]}
                placeholder="Say 'Start tracking'..."
                placeholderTextColor={theme.subText}
                value={aiCommand}
                onChangeText={setAiCommand}
              />
              <TouchableOpacity
                style={[styles.executeBtn, { backgroundColor: theme.primary }]}
                onPress={handleAIVoiceCommand}
              >
                <Ionicons name="send" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showSearch && routePoints.length === 0 && (
          <View style={[styles.premiumCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="navigate-circle" size={24} color={theme.danger} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Destination Dispatch
              </Text>
            </View>
            <TextInput
              placeholder="Enter Destination (e.g. Civil Hospital)"
              placeholderTextColor={theme.subText}
              value={destination}
              onChangeText={setDestination}
              style={[
                styles.premiumInputFull,
                { color: theme.text, borderBottomColor: theme.border },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.premiumActionBtn,
                { backgroundColor: theme.danger },
              ]}
              onPress={handleNavigation}
            >
              <Text style={styles.actionBtnText}>Start Navigation</Text>
            </TouchableOpacity>
          </View>
        )}

        {routePoints.length === 0 && (
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: isTracking ? theme.danger : "#34C759" },
              ]}
              onPress={toggleTracking}
            >
              <Ionicons
                name={isTracking ? "stop" : "radio-outline"}
                size={22}
                color="#fff"
              />
              <Text style={styles.toggleButtonText}>
                {isTracking ? "Stop Tracking" : "Start Live Tracking"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {routeAlert && (
        <View style={styles.floatingAlertOverlay}>
          <View
            style={[
              styles.alertCard,
              { backgroundColor: "rgba(26, 29, 35, 0.95)" },
            ]}
          >
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setRouteAlert(null)}
            >
              <Ionicons name="close" size={24} color={theme.subText} />
            </TouchableOpacity>

            <View style={styles.alertHeader}>
              <View
                style={[
                  styles.alertIconBox,
                  {
                    backgroundColor:
                      routeAlert.type === "blockade"
                        ? "rgba(255, 82, 71, 0.2)"
                        : "rgba(52, 199, 89, 0.2)",
                  },
                ]}
              >
                <Ionicons
                  name={
                    routeAlert.type === "blockade"
                      ? "warning"
                      : "checkmark-circle"
                  }
                  size={32}
                  color={
                    routeAlert.type === "blockade" ? theme.danger : "#34C759"
                  }
                />
              </View>
              <Text style={[styles.alertTitle, { color: theme.text }]}>
                {routeAlert.type === "blockade"
                  ? "Route Blocked"
                  : "Route Clear"}
              </Text>
            </View>

            {routeAlert.type === "blockade" && (
              <View style={styles.alertDetails}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subText }]}>
                    REASON:
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {routeAlert.reason}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subText }]}>
                    DURATION:
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {routeAlert.days} Days
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.premiumActionBtn,
                    { backgroundColor: theme.danger, marginTop: 20 },
                  ]}
                  onPress={() => {
                    setRoutePoints(altRoute);
                    setAltRoute([]);
                    setRouteAlert(null);
                  }}
                >
                  <Text style={styles.actionBtnText}>
                    Use Alternative Route
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {routeAlert.type === "safe" && (
              <View style={styles.alertDetails}>
                <Text style={[styles.alertText, { color: theme.subText }]}>
                  No blockages detected on this trajectory.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.premiumActionBtn,
                    { backgroundColor: "#34C759", marginTop: 20 },
                  ]}
                  onPress={() => setRouteAlert(null)}
                >
                  <Text style={styles.actionBtnText}>
                    Proceed with Navigation
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 🤖 Premium centerAlert Overlays */}
      {centerAlert && (
        <View style={styles.centerOverlay}>
          {centerAlert.title.toLowerCase().includes("error") ||
          centerAlert.title.toLowerCase().includes("denied") ||
          centerAlert.title.toLowerCase().includes("ready") ? (
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
                  onPress={() => setCenterAlert(null)}
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
                  {"Understood. "}
                  <Text style={{ fontWeight: "bold", color: "#FFF" }}>
                    {centerAlert.message.includes("Initiating")
                      ? "Initiating"
                      : "Terminating"}
                  </Text>
                  {centerAlert.message.split(
                    centerAlert.message.includes("Initiating")
                      ? "Initiating"
                      : "Terminating",
                  )[1] || ""}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.aiPrimaryBtn}
                activeOpacity={0.8}
                onPress={() => setCenterAlert(null)}
              >
                <Text style={styles.aiPrimaryBtnText}>Understood</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.alertCard}>
              <Text
                style={[
                  styles.alertTitle,
                  { color: theme.text, textAlign: "center" },
                ]}
              >
                {centerAlert.title}
              </Text>
              <Text
                style={[
                  styles.alertText,
                  { color: theme.subText, marginTop: 10 },
                ]}
              >
                {centerAlert.message}
              </Text>
              <TouchableOpacity
                style={[
                  styles.premiumActionBtn,
                  { backgroundColor: theme.primary, marginTop: 20 },
                ]}
                onPress={() => setCenterAlert(null)}
              >
                <Text style={styles.actionBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0F1217" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F1217" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#B0D1FF" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#718096" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1A222F" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1A1D23" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2D3748" }],
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
    stylers: [{ color: "#0D1117" }],
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
  headerOverlay: {
    paddingHorizontal: 15,
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    marginTop: 40,
    marginHorizontal: 15,
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  searchButton: {
    padding: 8,
  },
  premiumCard: {
    margin: 15,
    padding: 20,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 15,
    paddingHorizontal: 15,
  },
  premiumInput: {
    flex: 1,
    height: 50,
    fontSize: 15,
    fontWeight: "600",
  },
  premiumInputFull: {
    height: 50,
    fontSize: 16,
    fontWeight: "600",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    marginBottom: 15,
  },
  executeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  premiumActionBtn: {
    height: 55,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  toggleButton: {
    flexDirection: "row",
    padding: 18,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  toggleButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  ambulanceMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  ambulanceMarkerCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  trafficLightPill: {
    width: 20,
    height: 36,
    backgroundColor: "#000",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
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
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
  },
  floatingAlertOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    pointerEvents: "box-none",
    zIndex: 1000,
  },
  alertCard: {
    width: "100%",
    borderRadius: 30,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  alertHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  alertIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  alertDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  alertText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  // Dispatch Card UI
  dispatchOverlay: {
    position: "absolute",
    bottom: 30,
    left: 15,
    right: 15,
    zIndex: 100,
  },
  dispatchCard: {
    borderRadius: 25,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  dispatchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  dispatchIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dispatchTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  dispatchSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  liveIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
  },
  dispatchDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 18,
  },
  dispatchActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  trackingToggleSmall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 15,
    gap: 8,
  },
  trackingToggleText: {
    fontSize: 13,
    fontWeight: "700",
  },
  endMissionBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 15,
    gap: 8,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  endMissionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  voiceFab: {
    position: "absolute",
    bottom: 110,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  // --- PREMIUM OVERLAY STYLES ---
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
    padding: 20,
  },
  errorCard: {
    backgroundColor: "#2C1B1B",
    width: "95%",
    borderRadius: 32,
    padding: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.1)",
  },
  errorIconContainer: { marginRight: 16 },
  errorIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  errorContent: { flex: 1 },
  errorTitle: {
    color: "#FFF",
    fontSize: 18,
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
    fontSize: 13,
    letterSpacing: 1,
  },
  aiAgentCard: {
    backgroundColor: "#1A1D23",
    width: "90%",
    borderRadius: 36,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  aiIconWrapper: {
    marginBottom: 20,
    shadowColor: "#007AFF",
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  aiIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#2C3E50",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(93, 156, 255, 0.3)",
  },
  aiAgentTitle: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 20,
  },
  aiMessageContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    width: "100%",
  },
  aiMessageText: {
    color: "#E5E5E5",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  aiPrimaryBtn: {
    backgroundColor: "#007AFF",
    width: "100%",
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#007AFF",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  aiPrimaryBtnText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  aiBottomTagline: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    marginTop: 10,
  },
  hydroMarker: {
    padding: 6,
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
    fontSize: 14,
  },
});

export default AmbulanceMap;
