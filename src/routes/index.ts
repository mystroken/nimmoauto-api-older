import { Router } from 'express';
import userRoutes from './userRoutes';
import getVehicules from './Vehicule';
import getImmobilier from './Immobilier.routes';
import blogRoutes from './blog.routes';
import whatsappRoutes from './whatsapp.routes';
import postRoutes from './post.routes';
import postizRoutes from './postiz.routes';
import facebookBotRoutes from './facebookBot.routes';
import postToMeta from './postToMeta.routes'


const router = Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
router.use('/users', userRoutes);
router.use('/vehicules', getVehicules);
router.use('/immobilier', getImmobilier);
router.use('/blog', blogRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/post', postRoutes);
router.use('/postiz', postizRoutes);
router.use('/facebook-bot', facebookBotRoutes);
router.use('/meta', postToMeta)

export default router;