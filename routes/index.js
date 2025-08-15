import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import authRoutes from './auth.js';
import fileRoutes from './file.js';

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ message: 'Backend is running' });
});

// Auth Routes
router.use('/auth', authRoutes);
router.use('/files', fileRoutes);

export default router;
