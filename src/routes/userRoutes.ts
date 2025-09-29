import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/userController';
import { apiLimiter, strictLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply general rate limiting to all user routes
router.use(apiLimiter);

// GET /api/users - Get all users
router.get('/', getAllUsers);

// GET /api/users/:id - Get single user
router.get('/:id', getUserById);

// POST /api/users - Create new user
router.post('/', createUser);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/:id - Delete user (strict rate limiting)
router.delete('/:id', strictLimiter, deleteUser);

export default router; 