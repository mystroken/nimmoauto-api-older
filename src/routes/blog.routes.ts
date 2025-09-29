import { Router } from 'express';
import { getLink } from '../controllers/blogScrap';

const router = Router();

router.post('/one', getLink);

export default router;