import express from 'express';
import { postToSocialMedia } from '../controllers/postiz';

const router = express.Router();

router.post('/postiz', postToSocialMedia);

export default router; 