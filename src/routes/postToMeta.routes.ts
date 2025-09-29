import express from 'express';
import { postToMeta } from '../controllers/PostToMeta';

const router = express.Router();

router.post('/post-to-meta', postToMeta);

export default router; 