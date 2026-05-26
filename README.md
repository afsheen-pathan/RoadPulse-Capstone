# 🚦 RoadPulse – Real-Time Smart Navigation System

RoadPulse is an intelligent real-time navigation system designed to improve coordination between citizens, contractors, and emergency services. It aims to reduce traffic congestion, enhance route efficiency, and improve emergency response time using live data and smart routing.

---

## 🚀 Features

- 🚑 **Vanguard Bubble**  
  Real-time proximity-based alert system for emergency vehicles.

- 🚧 **Flash Red-Lining**  
  Contractors can instantly mark blocked roads on the map.

- 🌊 **Hydro-Map**  
  Crowdsourced flood reporting with severity levels.

- 🚦 **Virtual V2I**  
  Simulated smart traffic signal prioritization for ambulances.

- 🧭 **Dynamic Routing (OSRM)**  
  Real-time route calculation avoiding blocked and hazardous areas.

---

## 🧠 Tech Stack

### Frontend
- React Native (Expo)

### Backend
- Node.js
- Express.js

### Real-Time Communication
- Socket.io (WebSockets)

### Database
- MongoDB (Geospatial Indexing)

### Routing Engine
- OSRM (Open Source Routing Machine)

---

## ⚙️ How It Works

1. Users continuously send GPS data to the server.
2. The backend processes location data using the Haversine formula.
3. Real-time events (alerts, updates) are triggered using Socket.io.
4. MongoDB stores and retrieves geospatial data efficiently.
5. OSRM calculates optimal routes while avoiding blocked or hazardous zones.

---

## 📸 Screenshots

## 🚧 Contractor Module

<table align="center">
<tr>

<td align="center">
<img src="screenshots/contractor/login.jpeg" width="220"/>
<br><b>Login</b>
</td>

<td align="center">
<img src="screenshots/contractor/registration.jpeg" width="220"/>
<br><b>Registration</b>
</td>

<td align="center">
<img src="screenshots/contractor/registration-success.jpeg" width="220"/>
<br><b>Registration Success</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/contractor/profile.jpeg" width="220"/>
<br><b>Profile</b>
</td>

<td align="center">
<img src="screenshots/contractor/report-roadblock.jpeg" width="220"/>
<br><b>Report Roadblock</b>
</td>

<td align="center">
<img src="screenshots/contractor/blockag-report.jpeg" width="220"/>
<br><b>Blockage Report</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/contractor/blockage-success.jpeg" width="220"/>
<br><b>Blockage Success</b>
</td>

<td align="center">
<img src="screenshots/contractor/road-block-dashboard.jpeg" width="220"/>
<br><b>Road Block Dashboard</b>
</td>

<td align="center">
<img src="screenshots/contractor/clear-all.jpeg" width="220"/>
<br><b>Clear All Blockages</b>
</td>

</tr>
</table>

---

## 🧑 Citizen Module

<table align="center">
<tr>

<td align="center">
<img src="screenshots/citizen/dashboard.jpeg" width="220"/>
<br><b>Citizen Dashboard</b>
</td>

<td align="center">
<img src="screenshots/citizen/dashboard-2.jpeg" width="220"/>
<br><b>Dashboard View 2</b>
</td>

<td align="center">
<img src="screenshots/citizen/dashboard-3.jpeg" width="220"/>
<br><b>Dashboard View 3</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/citizen/profile.jpeg" width="220"/>
<br><b>User Profile</b>
</td>

<td align="center">
<img src="screenshots/citizen/search-location.jpeg" width="220"/>
<br><b>Search Location</b>
</td>

<td align="center">
<img src="screenshots/citizen/road-blocked-details.jpeg" width="220"/>
<br><b>Road Block Details</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/citizen/roadblock-alert.jpeg" width="220"/>
<br><b>Roadblock Alert</b>
</td>

<td align="center">
<img src="screenshots/citizen/report-waterlogged.jpeg" width="220"/>
<br><b>Report Waterlogging</b>
</td>

<td align="center">
<img src="screenshots/citizen/waterlogged-details.jpeg" width="220"/>
<br><b>Waterlogging Details</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/citizen/waterlogged-status.jpeg" width="220"/>
<br><b>Waterlogging Status</b>
</td>

<td align="center">
<img src="screenshots/citizen/watelogged-onMap.jpeg" width="220"/>
<br><b>Flood Visualization</b>
</td>

<td align="center">
<img src="screenshots/citizen/water-alert.jpeg" width="220"/>
<br><b>Flood Alert</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/citizen/report-with-ai.jpeg" width="220"/>
<br><b>AI Assisted Report</b>
</td>

<td align="center">
<img src="screenshots/citizen/ai-report.jpeg" width="220"/>
<br><b>AI Report Output</b>
</td>

<td align="center">
<img src="screenshots/citizen/citizen-ambulance-alert.jpeg" width="220"/>
<br><b>Ambulance Alert</b>
</td>

</tr>
</table>

---

## 🚑 Ambulance Module

<table align="center">
<tr>

<td align="center">
<img src="screenshots/ambulance/dashboard.jpeg" width="220"/>
<br><b>Ambulance Dashboard</b>
</td>

<td align="center">
<img src="screenshots/ambulance/profile.jpeg" width="220"/>
<br><b>Driver Profile</b>
</td>

<td align="center">
<img src="screenshots/ambulance/search-location.jpeg" width="220"/>
<br><b>Search Location</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/ambulance/location-search.jpeg" width="220"/>
<br><b>Location Search</b>
</td>

<td align="center">
<img src="screenshots/ambulance/route-start.jpeg" width="220"/>
<br><b>Start Route</b>
</td>

<td align="center">
<img src="screenshots/ambulance/route-clear-done.jpeg" width="220"/>
<br><b>Route Cleared</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/ambulance/tracking-start.jpeg" width="220"/>
<br><b>Tracking Started</b>
</td>

<td align="center">
<img src="screenshots/ambulance/location-start-tracking-off.jpeg" width="220"/>
<br><b>Tracking Off</b>
</td>

<td align="center">
<img src="screenshots/ambulance/signal-green.jpeg" width="220"/>
<br><b>Green Signal Priority</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/ambulance/blockage-details.jpeg" width="220"/>
<br><b>Road Blockage Details</b>
</td>

<td align="center">
<img src="screenshots/ambulance/ai-tracking.jpeg" width="220"/>
<br><b>AI Tracking</b>
</td>

<td align="center">
<img src="screenshots/ambulance/ai-tracking-command.jpeg" width="220"/>
<br><b>AI Tracking Command</b>
</td>

</tr>
</table>

<br>

<table align="center">
<tr>

<td align="center">
<img src="screenshots/ambulance/tracking-start-ai.jpeg" width="220"/>
<br><b>AI Tracking Start</b>
</td>

<td align="center">
<img src="screenshots/ambulance/tracking-stop-ai.jpeg" width="220"/>
<br><b>AI Tracking Stop</b>
</td>

</tr>
</table>

## 📱 Use Case

- Emergency vehicles get priority movement through traffic.
- Users receive real-time alerts to clear lanes.
- Roads blocked by construction are instantly visible.
- Flood-prone areas are avoided dynamically.

---

## 🔮 Future Scope

- Integration with IoT-based traffic signals
- AI-based predictive traffic analysis
- Smart city infrastructure connectivity

---

## 🧑‍💻 Installation

```bash
# Clone the repository
git clone https://github.com/your-username/roadpulse.git

# Navigate to project
cd roadpulse

# Install dependencies
npm install

# Start backend
npm start

# Start frontend (Expo)
npx expo start
