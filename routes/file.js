import express from 'express';
import multer from 'multer';
import { supabase } from '../config/supabaseClient.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { randomUUID } from 'crypto';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * UPLOAD FILE
 */
router.post('/upload', authMiddleware, upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files[0];
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${randomUUID()}.${fileExt}`;
    const filePath = `${req.user.id}/${fileName}`;

    // 📌 Pick up folder_id if client sends it
    const folderId = req.body.folder_id || null;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError)
      return res.status(400).json({ error: uploadError.message });

    // Save metadata to DB
    const { error: dbError } = await supabase.from('files').insert([
      {
        user_id: req.user.id,
        name: file.originalname,
        path: filePath,
        size: file.size,
        type: file.mimetype,
        folder_id: folderId, // 👈 link file to folder
      },
    ]);

    if (dbError) return res.status(400).json({ error: dbError.message });

    res.json({ message: 'File uploaded successfully', path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * LIST FILES (with optional folder & pagination)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'created_at';
    const order = req.query.order === 'asc' ? true : false;
    const folderId = req.query.folderId || null;

    const { data, error, count } = await supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .eq('folder_id', folderId) // 👈 filter by folder
      .order(sortBy, { ascending: order })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      total: count,
      limit,
      offset,
      files: data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * SEARCH FILES
 */
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const query = req.query.q || '';
    const folderId = req.query.folderId || null;

    if (!query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('folder_id', folderId) // 👈 allow searching inside a folder
      .ilike('name', `%${query}%`)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DOWNLOAD FILE (signed URL)
 */
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fileError || !fileData)
      return res.status(404).json({ error: 'File not found' });

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from('files')
        .createSignedUrl(fileData.path, 60 * 5); // 5 minutes validity

    if (signedUrlError)
      return res.status(400).json({ error: signedUrlError.message });

    res.json({ url: signedUrlData.signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE FILE
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fileError || !fileData)
      return res.status(404).json({ error: 'File not found' });

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([fileData.path]);

    if (storageError)
      return res.status(400).json({ error: storageError.message });

    // Delete from DB
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (dbError) return res.status(400).json({ error: dbError.message });

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
