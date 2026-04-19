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
