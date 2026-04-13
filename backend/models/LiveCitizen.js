const mongoose = require('mongoose');

const liveCitizenSchema = new mongoose.Schema({
    socketId: {
        type: String,
        required: true,
        unique: true
    },
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
    }
}, { timestamps: true });

liveCitizenSchema.index({ location: "2dsphere" });

module.exports = mongoose.model('LiveCitizen', liveCitizenSchema);
