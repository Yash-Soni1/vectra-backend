import express from 'express';
import { supabase } from '../config/supabaseClient.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * Create folder
 * body: { name: string, parent_id?: string }
 */
router.post('/', authMiddleware, async (req, res) => {
  const { name, parent_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name required' });
  }
  const { error } = await supabase.from('folders').insert([{
    user_id: req.user.id,
    name: name.trim(),
    parent_id: parent_id || null
  }]);
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ message: 'Folder created' });
});

/**
 * List folders in a parent
 * query: ?parentId=uuid | null for root
 */
router.get('/', authMiddleware, async (req, res) => {
  const parentId = req.query.parentId ?? null;
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', req.user.id)
    .is('parent_id', parentId);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/**
 * Rename folder
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  const { name } = req.body;
  const { error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Folder renamed' });
});

/**
 * Delete a folder (only if empty)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  const folderId = req.params.id;

  // Check emptiness: any subfolders?
  const { data: childFolders, error: cfErr } = await supabase
    .from('folders').select('id').eq('parent_id', folderId).limit(1);
  if (cfErr) return res.status(400).json({ error: cfErr.message });
  if (childFolders?.length) {
    return res.status(400).json({ error: 'Folder not empty (contains folders).' });
  }

  // Any files inside?
  const { data: childFiles, error: flErr } = await supabase
    .from('files').select('id').eq('folder_id', folderId).limit(1);
  if (flErr) return res.status(400).json({ error: flErr.message });
  if (childFiles?.length) {
    return res.status(400).json({ error: 'Folder not empty (contains files).' });
  }

  const { error } = await supabase
    .from('folders').delete()
    .eq('id', folderId)
    .eq('user_id', req.user.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Folder deleted' });
});

export default router;
