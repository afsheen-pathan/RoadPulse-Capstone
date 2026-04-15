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
 * @access  Private
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { coordinates, reason, days } = req.body;

        // ✅ Validation
        if (!coordinates) {
            return res.status(400).json({ message: 'Coordinates are required' });
        }

        if (!reason) {
            return res.status(400).json({ message: 'Reason is required' });
        }

        if (!days) {
            return res.status(400).json({ message: 'Days is required' });
        }

        const newBlockade = new Blockade({
            contractor: req.user.id,
            location: {
                type: 'Polygon',
                coordinates
            },
            reason,
            days: Number(days)
        });

        const savedBlockade = await newBlockade.save();

        // ✅ Emit new blockade
        const io = req.app.get('io');
        if (io) {
            io.emit('NEW_ROADBLOCK', savedBlockade);
        }

        // ✅ AUTO REMOVE AFTER DAYS
        const expiryTime = Number(days) * 24 * 60 * 60 * 1000;

        setTimeout(async () => {
            try {
                await Blockade.findByIdAndDelete(savedBlockade._id);

                if (io) {
                    io.emit('REMOVE_BLOCKADE', savedBlockade._id);
                }

                console.log("🗑️ Blockade auto removed");
            } catch (err) {
                console.error("Auto delete error:", err);
            }
        }, expiryTime);

        res.status(201).json(savedBlockade);

    } catch (error) {
        console.error('Error saving blockade:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   DELETE /api/blockades/clear
 * @desc    Delete ALL blockades
 * @access  Public (or protect if needed)
 */
router.delete('/clear', async (req, res) => {
    try {
        await Blockade.deleteMany({});

        const io = req.app.get('io');
        if (io) {
            io.emit('REMOVE_ALL_BLOCKADES'); // 🔥 important
        }

        res.json({ message: "All blockages deleted" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error clearing blockades" });
    }
});

module.exports = router;