# 🚦 RoadPulse – AI-Powered Real-Time Smart Navigation System

<p align="center">

![Platform](https://img.shields.io/badge/Platform-React%20Native-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js-success)
![Database](https://img.shields.io/badge/Database-MongoDB-green)
![Realtime](https://img.shields.io/badge/Realtime-Socket.IO-black)
![Routing](https://img.shields.io/badge/Routing-OSRM-orange)
![Deployment](https://img.shields.io/badge/Backend-Render-purple)

</p>

RoadPulse is an AI-powered Smart Navigation System designed to improve urban traffic management by connecting citizens, contractors, and emergency responders through a real-time mobile platform.

The system combines **real-time communication, AI-assisted reporting, geospatial intelligence, and intelligent route optimization** to reduce emergency response time, avoid blocked roads, and improve public safety.

---

## 🌐 Live Demo & Deployment

### 🚀 Backend (Live)

**API URL**

https://roadpulse-backend-xpdy.onrender.com

**Health Check**

https://roadpulse-backend-xpdy.onrender.com/health

> Backend deployed on **Render** with **MongoDB Atlas**. Render automatically performs health checks before routing traffic to the service. :contentReference[oaicite:0]{index=0}

---

### 📱 Android APK

🚧 **Building with Expo EAS...**

APK download link will be updated automatically after the build completes.

---

### 💻 GitHub Repository

https://github.com/afsheen-pathan/RoadPulse-Capstone

---
---

## 🚀 Features

- 🚑 **Emergency Vehicle Priority (Vanguard Bubble)**  
  Notifies nearby citizens in real time when an ambulance is approaching, helping clear traffic and reduce emergency response time.

- 🚧 **Live Road Block Reporting (Flash Red-Lining)**  
  Contractors can instantly report construction zones and blocked roads, which are immediately visible to all users.

- 🌊 **Flood & Waterlogging Detection (Hydro-Map)**  
  Citizens can report waterlogged areas with severity levels, allowing other users to avoid unsafe routes.

- 🤖 **AI-Assisted Incident Reporting**  
  Integrated with Google Gemini AI to generate structured and detailed incident reports from user inputs, reducing manual effort.

- 🧭 **Smart Dynamic Routing (OSRM)**  
  Calculates the fastest route while intelligently avoiding blocked roads, flood zones, and traffic disruptions.

- 📡 **Real-Time GPS Tracking**  
  Continuously tracks emergency vehicles and updates their live location using Socket.IO and WebSockets.

- 🚦 **Virtual Vehicle-to-Infrastructure (V2I)**  
  Simulates intelligent traffic signal prioritization by providing green-light preference for emergency vehicles.

- 🔔 **Instant Real-Time Notifications**  
  Broadcasts road closures, emergency alerts, flood warnings, and traffic updates instantly to connected users.

- 🗺️ **Geospatial Intelligence**  
  Uses MongoDB Geospatial Indexing and the Haversine Formula for efficient location-based queries and nearby event detection.

- 👥 **Role-Based Access Control**  
  Separate dashboards and permissions for Citizens, Contractors, and Ambulance Drivers to ensure secure and organized operations.

- ☁️ **Cloud-Deployed Backend**  
  Backend API is deployed on Render with MongoDB Atlas, providing a scalable and production-ready infrastructure.

- 📱 Cross-Platform Mobile Application**  
  Built with React Native and Expo, enabling the application to run seamlessly on Android devices.
---

## 🧠 Tech Stack

### 📱 Frontend
- React Native
- Expo

### ⚙️ Backend
- Node.js
- Express.js

### 🗄️ Database
- MongoDB Atlas
- Geospatial Indexing

### 🔄 Real-Time Communication
- Socket.IO

### 🤖 Artificial Intelligence
- Google Gemini API

### 🗺️ Maps & Routing
- OSRM (Open Source Routing Machine)
- Haversine Formula

### ☁️ Deployment
- Render (Backend)
- Expo EAS Build

---

## ⚙️ How It Works

1. Users continuously send GPS data to the server.
2. The backend processes location data using the Haversine formula.
3. Real-time events (alerts, updates) are triggered using Socket.io.
4. MongoDB stores and retrieves geospatial data efficiently.
5. OSRM calculates optimal routes while avoiding blocked or hazardous zones.

---

---

## 🏗️ System Architecture

```text
             React Native (Expo)
                      │
                      ▼
          Express.js REST API (Render)
                      │
      ┌───────────────┼───────────────┐
      │               │               │
      ▼               ▼               ▼
 MongoDB Atlas    Socket.IO       Gemini AI
      │               │
      └───────────────┼───────────────┘
                      ▼
               OSRM Routing Engine
```

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

## 📱 Real-World Use Cases

- 🚑 Emergency vehicles receive intelligent route prioritization.
- 🚦 Citizens receive real-time alerts to clear emergency lanes.
- 🚧 Contractors instantly report road blockages.
- 🌊 Flood-prone areas are detected and avoided dynamically.
- 🤖 AI assists users in generating structured incident reports.
- 📡 Live tracking improves coordination between emergency responders and citizens.

---

## 🔮 Future Scope

- IoT-enabled Smart Traffic Signals
- AI-based Predictive Traffic Analysis
- Machine Learning for Congestion Prediction
- Government Smart City Integration
- Push Notifications
- Offline Navigation Support
- Multi-City Deployment

---

## 🧑‍💻 Installation

### Clone Repository

```bash
git clone https://github.com/afsheen-pathan/RoadPulse-Capstone.git

cd RoadPulse-Capstone
```

---

### Backend Setup

```bash
cd backend

npm install

npm start
```

---

### Frontend Setup

```bash
cd roadpulse-app

npm install

npx expo start
```

---

### Environment Variables

Backend

```env
MONGO_URI=
JWT_SECRET=
```

Frontend

```env
EXPO_PUBLIC_API_URL=https://roadpulse-backend-xpdy.onrender.com
```

---

---

## 👨‍💻 Developer

**Afshin Pathan**

📍 Ahmedabad, Gujarat, India

GitHub:
https://github.com/afsheen-pathan

---

⭐ If you found this project useful, consider giving it a star!
