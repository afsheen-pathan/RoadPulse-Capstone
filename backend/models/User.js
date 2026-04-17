const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Ambulance', 'Contractor', 'Citizen', 'Admin'],
        required: true
    },
    profilePicture: {
        type: String, // Base64 or local path for now
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
