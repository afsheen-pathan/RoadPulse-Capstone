const mongoose = require('mongoose');

const hydroReportSchema = new mongoose.Schema({
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    depth: {
        type: String,
        enum: ['Ankle', 'Knee', 'Waist'],
        required: true
    },
    reportedAt: {
        type: Date,
        default: Date.now
    },
    // --- Task 14: TTL Field ---
    expiresAt: {
        type: Date,
        index: { expires: '0s' } // MongoDB deletes when Date.now() >= expiresAt
    }
});

// --- Task 14: Tiered Decay Hook ---
hydroReportSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('depth')) {
        let duration = 0;
        switch (this.depth) {
            case 'Ankle':
                duration = 45 * 60 * 1000; // 45 mins
                break;
            case 'Knee':
                duration = 3 * 60 * 60 * 1000; // 3 hours
                break;
            case 'Waist':
                duration = 6 * 60 * 60 * 1000; // 6 hours (Instruction says 12 hrs in text but formula says 6. I'll stick to 6 as per math provided)
                break;
        }
        this.expiresAt = new Date(Date.now() + duration);
    }
    next();
});

hydroReportSchema.index({ location: "2dsphere" });

module.exports = mongoose.model('HydroReport', hydroReportSchema);
