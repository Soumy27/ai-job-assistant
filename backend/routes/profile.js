const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getProfile, saveProfile } = require('../db');

// Get profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile) return res.json({ personalInfo: {}, academicInfo: {}, professionalInfo: {}, bio: '' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile: ' + err.message });
  }
});

// Update profile
router.put('/', authMiddleware, async (req, res) => {
  try {
    const updated = await saveProfile(req.user.id, req.body);
    res.json({ message: 'Profile updated', profile: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save profile: ' + err.message });
  }
});

module.exports = router;
