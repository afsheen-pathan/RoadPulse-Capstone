const mongoose = require('mongoose');

const blockadeSchema = new mongoose.Schema({
    contractor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Polygon'],
            required: true
        },
        coordinates: {
            type: [[[Number]]], // Array of linear rings
            required: true
        }
    },
    reason: {
  type: String,
  required: true
},
days: {
  type: Number,
  required: true
}
}, { timestamps: true });

blockadeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Blockade', blockadeSchema);