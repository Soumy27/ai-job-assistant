const express = require('express');
const router = express.Router();
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getApplications, createApplication, updateApplicationStatus, deleteApplication } = require('../db');

const VALID_STATUSES = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected'];

const createSchema = z.object({
  company: z.string().trim().min(1, 'company is required'),
  role: z.string().trim().min(1, 'role is required'),
  status: z.enum(VALID_STATUSES).optional(),
  source: z.string().optional(),
  jobUrl: z.string().optional(),
  deadline: z.string().nullable().optional(),
});
const statusSchema = z.object({
  status: z.enum(VALID_STATUSES, { message: 'status must be one of: ' + VALID_STATUSES.join(', ') }),
});

// GET /api/applications — list the logged-in user's applications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const apps = await getApplications(req.user.id);
    res.json({ applications: apps });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load applications: ' + err.message });
  }
});

// POST /api/applications — create one
router.post('/', authMiddleware, validate(createSchema), async (req, res) => {
  try {
    const app = await createApplication(req.user.id, req.body);
    res.status(201).json({ message: 'Application added', application: app });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create application: ' + err.message });
  }
});

// PATCH /api/applications/:id — update status only
router.patch('/:id', authMiddleware, validate(statusSchema), async (req, res) => {
  const { status } = req.body;
  try {
    const app = await updateApplicationStatus(req.user.id, req.params.id, status);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json({ message: 'Status updated', application: app });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update: ' + err.message });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await deleteApplication(req.user.id, req.params.id);
    res.json({ message: 'Application deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete: ' + err.message });
  }
});

module.exports = router;
