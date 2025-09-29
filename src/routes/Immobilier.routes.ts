import { Router } from 'express';
import { getANewImmobilier, getAnImmobilier, getImmobilier } from '../controllers/immo';
import { getTenImmobiliers } from '../controllers/immo';
const router = Router();

router.get('/all', getImmobilier);
router.get('/one', getAnImmobilier);
router.get('/new', getANewImmobilier);  
router.get('/ten', getTenImmobiliers);

export default router;