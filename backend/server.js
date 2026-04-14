const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const blockadeRoutes = require('./routes/blockadeRoutes');
const LiveCitizen = require('./models/LiveCitizen');
const HydroReport = require('./models/HydroReport');


// Phase 5: Virtual Signal Data (V2I)
const SMART_INTERSECTIONS = [
    { id: 'INT_1', lat: 22.9975, lng: 72.5250, name: 'S.G. Highway Junction' },
    { id: 'INT_2', lat: 22.9960, lng: 72.5245, name: 'Prahladnagar Crossroad' },
    { id: 'INT_3', lat: 22.9980, lng: 72.5260, name: 'Satellite Circle' }
];

// Helper: Haversine distance in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}



const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/blockades', blockadeRoutes);

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
    console.warn('WARNING: MONGO_URI is not defined in .env file.');
}

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB Connected Successfully');
        
        // THE FIX: Wipe the live tracking collection every time the server boots 
        // to prevent ghost records from previous crashed sessions.
        await LiveCitizen.deleteMany({});
        console.log('🧹 Cleared old ghost citizens from database.');
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    // Send initial intersection data to client
    socket.emit('INITIAL_INTERSECTIONS', SMART_INTERSECTIONS);

    // Phase 6: Sync existing Hydro-Reports
    HydroReport.find().then(reports => {
        socket.emit('INITIAL_HYDRO_REPORTS', reports);
    }).catch(err => console.error('Error fetching hydro reports:', err.message));



    // Phase 2: Contractor Roadblocks
    socket.on('ADD_ROADBLOCK', (payload) => {
        console.log('🚧 New road block event received:', payload);
        io.emit('NEW_ROADBLOCK', payload);
    });

    // Phase 3: Ambulance Live Tracking & Vanguard Bubble
    socket.on('AMBULANCE_LOCATION_UPDATE', async (data) => {
        // 1. Force absolute float numbers for MongoDB math
        const lng = parseFloat(data.longitude);
        const lat = parseFloat(data.latitude);
        
        console.log(`\n🚑 [AMBULANCE] Live Location Update: Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`);
        
        // 2. Broadcast to Citizens
        io.emit('LIVE_AMBULANCE_TRACKING', { latitude: lat, longitude: lng });

        // 3. Vanguard Bubble Math
        try {
            const RADIUS_METERS = 500;
            const RADIUS_RADIANS = RADIUS_METERS / 6378100;

            const citizensInRadius = await LiveCitizen.find({
                location: {
                    $geoWithin: {
                        $centerSphere: [[lng, lat], RADIUS_RADIANS]
                    }
                }
            });

            // Always log the result, even if it's 0, so we know the query ran!
            console.log(`⚠️  [Vanguard Bubble] Found ${citizensInRadius.length} citizens within 500m.`);

            if (citizensInRadius.length > 0) {
                citizensInRadius.forEach(citizen => {
                    io.to(citizen.socketId).emit('CLEAR_PATH');
                });
            }
        } catch (error) {
            console.error('❌ Vanguard Bubble Math Error:', error.message);
        }

        // 4. Virtual Signals (V2I): Toggle Green lights within 200m
        SMART_INTERSECTIONS.forEach(intersection => {
            const distance = calculateDistance(lat, lng, intersection.lat, intersection.lng);
            
            if (distance < 200) {
                io.emit('SIGNAL_OVERRIDE', { intersectionId: intersection.id, status: 'GREEN' });
            } else {
                // Fallback to RED if ambulance is far
                io.emit('SIGNAL_OVERRIDE', { intersectionId: intersection.id, status: 'RED' });
            }
        });
    });


    // Phase 4: Citizen Live Radar
    socket.on('CITIZEN_LOCATION_UPDATE', async (data) => {
        try {
            // Force pure floats
            const lng = parseFloat(data.longitude);
            const lat = parseFloat(data.latitude);

            await LiveCitizen.findOneAndUpdate(
                { socketId: socket.id },
                {
                    location: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                },
                { upsert: true, returnDocument: 'after' } // fixed Mongoose warning!
            );
        } catch (error) {
            console.error('❌ Error updating citizen location:', error.message);
        }
    });

    // Phase 6: Handle Crowdsourced Hydro-Reports
    socket.on('ADD_HYDRO_REPORT', async (data) => {
        try {
            console.log(`\n[BACKEND RECEIVE] Add Hydro Report triggered!`);
            
            const newReport = new HydroReport({
                location: {
                    type: 'Point',
                    coordinates: [data.longitude, data.latitude] 
                },
                depth: data.depth,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) 
            });

            const savedReport = await newReport.save();
            console.log(`✅ [DATABASE] New ${data.depth} flood report saved successfully.`);
            
            io.emit('NEW_HYDRO_REPORT', savedReport);
        } catch (error) {
            console.error('❌ Error adding hydro report:', error.message);
        }
    });

    // --- Task 14: Verification Listener ---
    socket.on('VERIFY_HYDRO_REPORT', async ({ reportId, isStillThere }) => {
        console.log(`\n[2. BACKEND RECEIVE] Event VERIFY_HYDRO_REPORT triggered!`);
        console.log(`[2. BACKEND RECEIVE] Payload -> reportId: ${reportId} | isStillThere: ${isStillThere}`);

        try {
            if (isStillThere === false) {
                // Attempt to delete from MongoDB
                console.log(`[3. DATABASE] Attempting to delete report ID: ${reportId} from MongoDB...`);
                const deletedDoc = await HydroReport.findByIdAndDelete(reportId);
                
                if (deletedDoc) {
                    console.log(`[3. DATABASE] ✅ Document found and successfully deleted.`);
                    console.log(`[3. BACKEND EMIT] Broadcasting REMOVE_HYDRO_REPORT to all clients...`);
                    io.emit('REMOVE_HYDRO_REPORT', reportId);
                } else {
                    console.log(`[3. DATABASE] ❌ WARNING: Could not find document in DB! It may have already expired or the ID is invalid.`);
                }
            } else {
                // Extend the life by 1 hour
                console.log(`[3. DATABASE] Attempting to extend lifespan for report ID: ${reportId}...`);
                const updatedReport = await HydroReport.findByIdAndUpdate(
                    reportId,
                    { $inc: { expiresAt: 60 * 60 * 1000 } }, // Add 1 hour in milliseconds
                    { new: true }
                );
                
                if (updatedReport) {
                    console.log(`[3. DATABASE] ✅ Extended lifespan successfully.`);
                    console.log(`[3. BACKEND EMIT] Broadcasting UPDATE_HYDRO_REPORT to all clients...`);
                    io.emit('UPDATE_HYDRO_REPORT', updatedReport);
                } else {
                    console.log(`[3. DATABASE] ❌ WARNING: Could not find document to update!`);
                }
            }
        } catch (error) {
            console.error('\n❌ [BACKEND ERROR] Verification Error:', error.message);
        }
    });

    socket.on('disconnect', async () => {

        console.log('🔌 Client disconnected:', socket.id);
        try {
            await LiveCitizen.deleteOne({ socketId: socket.id });
        } catch (error) {
            console.error('Error removing citizen on disconnect:', error.message);
        }
    });
});

// Basic Route
app.get('/', (req, res) => {
    res.send('RoadPulse API is running...');
});

// Start Server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});