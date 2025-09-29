import express from 'express';
import { loginToBusinessSuite } from '../controllers/facebookBot';

const router = express.Router();

router.post('/login', loginToBusinessSuite);

export default router; 