import express from 'express';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// SIGNUP
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Signup successful! Please verify your email.', user: data.user });
});

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Login successful', session: data.session });
});

// GET CURRENT USER
router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ user });
});

export default router;
