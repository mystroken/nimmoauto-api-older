import { Router } from 'express';
import { getANewVehicule, getAVehicule, getVehicules } from '../controllers/Vehicules';
import { getTenVehicules } from '../controllers/Vehicules';
const router = Router();

router.get('/all', getVehicules);
router.get('/one', getAVehicule);
router.get('/new', getANewVehicule);
router.get('/ten', getTenVehicules);

export default router;