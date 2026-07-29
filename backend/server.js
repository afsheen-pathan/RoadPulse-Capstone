const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Validate required environment variables
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];
REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

const authRoutes = require("./routes/authRoutes");
const blockadeRoutes = require("./routes/blockadeRoutes");
const LiveCitizen = require("./models/LiveCitizen");
const HydroReport = require("./models/HydroReport");

const app = express();
const server = http.createServer(app);

const SMART_INTERSECTIONS = [
  { id: "GU_1", lat: 23.038, lng: 72.551, name: "GU North Gate" },
  { id: "GU_2", lat: 23.0345, lng: 72.553, name: "Commerce Six Roads" },
  { id: "GU_3", lat: 23.0325, lng: 72.549, name: "Vijay Cross Road" },
  { id: "GU_4", lat: 23.0365, lng: 72.5475, name: "Helmet Circle" },
  { id: "GU_5", lat: 23.0355, lng: 72.5515, name: "Inside Campus Junction" },
  { id: "INT_1", lat: 22.9975, lng: 72.525, name: "S.G. Highway Junction" },
  { id: "INT_2", lat: 22.996, lng: 72.5245, name: "Prahladnagar Crossroad" },
  { id: "INT_3", lat: 22.998, lng: 72.526, name: "Satellite Circle" },
];

// 🔥 Distance function (RESTORED)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
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

  return R * c;
}

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// 🔥 IMPORTANT
app.set("io", io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/blockades", blockadeRoutes);

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB Connected");
    await LiveCitizen.deleteMany({});
    console.log("🧹 Cleared old citizens");
  })
  .catch((err) => console.error(err));

// 🔥 SOCKET LOGIC (FULL RESTORED + CLEANED)
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  // ✅ SEND INITIAL DATA (RESTORED)
  console.log("🚦 Sending intersections:", SMART_INTERSECTIONS);
  socket.emit("INITIAL_INTERSECTIONS", SMART_INTERSECTIONS);

  HydroReport.find()
    .then((reports) => {
      socket.emit("INITIAL_HYDRO_REPORTS", reports);
    })
    .catch((err) => console.error(err));

  // 🚧 ROADBLOCK
  socket.on("ADD_ROADBLOCK", (data) => {
    io.emit("NEW_ROADBLOCK", data);
  });

  // 🚑 AMBULANCE + VANGUARD + SIGNAL CONTROL
  socket.on("AMBULANCE_LOCATION_UPDATE", async (data) => {
    const lng = parseFloat(data.longitude);
    const lat = parseFloat(data.latitude);

    io.emit("LIVE_AMBULANCE_TRACKING", { latitude: lat, longitude: lng });

    try {
      // 🔥 Vanguard Bubble (RESTORED)
      const RADIUS_METERS = 500;
      const RADIUS_RADIANS = RADIUS_METERS / 6378100;

      const citizensInRadius = await LiveCitizen.find({
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], RADIUS_RADIANS],
          },
        },
      });

      citizensInRadius.forEach((citizen) => {
        io.to(citizen.socketId).emit("CLEAR_PATH");
      });
    } catch (err) {
      console.error(err);
    }

    // 🚦 Smart Signals (RESTORED)
    SMART_INTERSECTIONS.forEach((intersection) => {
      const distance = calculateDistance(
        lat,
        lng,
        intersection.lat,
        intersection.lng,
      );

      if (distance < 1000) {
        io.emit("SIGNAL_OVERRIDE", {
          intersectionId: intersection.id,
          status: "GREEN",
        });
      } else {
        io.emit("SIGNAL_OVERRIDE", {
          intersectionId: intersection.id,
          status: "RED",
        });
      }
    });
  });

  // 📍 CITIZEN TRACKING
  socket.on("CITIZEN_LOCATION_UPDATE", async (data) => {
    const lng = parseFloat(data.longitude);
    const lat = parseFloat(data.latitude);

    await LiveCitizen.findOneAndUpdate(
      { socketId: socket.id },
      {
        location: {
          type: "Point",
          coordinates: [lng, lat],
        },
      },
      { upsert: true },
    );
  });

  // 🌊 ADD HYDRO REPORT
  socket.on("ADD_HYDRO_REPORT", async (data) => {
    const newReport = new HydroReport({
      location: {
        type: "Point",
        coordinates: [data.longitude, data.latitude],
      },
      depth: data.depth,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const saved = await newReport.save();
    io.emit("NEW_HYDRO_REPORT", saved);
  });

  // 🔥 VERIFY HYDRO (RESTORED)
  socket.on("VERIFY_HYDRO_REPORT", async ({ reportId, isStillThere }) => {
    try {
      if (isStillThere === false) {
        const deleted = await HydroReport.findByIdAndDelete(reportId);
        if (deleted) {
          io.emit("REMOVE_HYDRO_REPORT", reportId);
        }
      } else {
        const updated = await HydroReport.findByIdAndUpdate(
          reportId,
          { $inc: { expiresAt: 60 * 60 * 1000 } },
          { new: true },
        );

        if (updated) {
          io.emit("UPDATE_HYDRO_REPORT", updated);
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  // ❌ DISCONNECT
  socket.on("disconnect", async () => {
    console.log("❌ Disconnected:", socket.id);
    await LiveCitizen.deleteOne({ socketId: socket.id });
  });
});

// Health & Test routes
app.get("/", (req, res) => {
  res.send("RoadPulse Backend Running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "RoadPulse Backend",
    timestamp: new Date().toISOString()
  });
});

// Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
