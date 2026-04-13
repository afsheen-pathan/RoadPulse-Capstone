const express = require('express');
const Blockade = require('../models/Blockade');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   GET /api/blockades
 * @desc    Fetch all existing blockades
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const blockades = await Blockade.find().populate('contractor', 'name email');
        res.json(blockades);
    } catch (error) {
        console.error('Error fetching blockades:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/blockades
 * @desc    Add a new blockade
 * @access  Private (Contractors)
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { coordinates, reason } = req.body;

        if (!coordinates) {
            return res.status(400).json({ message: 'Coordinates are required' });
        }

        const newBlockade = new Blockade({
            contractor: req.user.id,
            location: {
                type: 'Polygon',
                coordinates: coordinates
            },
            reason: reason || 'Road Construction'
        });

        const savedBlockade = await newBlockade.save();
        res.status(201).json(savedBlockade);
    } catch (error) {
        console.error('Error saving blockade:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
