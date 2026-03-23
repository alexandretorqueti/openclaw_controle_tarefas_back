const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const uploadMiddleware = require('../middlewares/uploadMiddleware');
// GET /api/users - Get all users
router.get('/', userController.getAllUsers);
// GET /api/users/:id - Get user by ID
router.get('/:id', userController.getUserById);
// POST /api/users - Create a new user
router.post('/', userController.createUser);
// POST /api/users/upload-avatar - Upload avatar for user
router.post('/upload-avatar', uploadMiddleware, userController.uploadAvatar);
// PUT /api/users/:id - Update user
router.put('/:id', userController.updateUser);
// DELETE /api/users/:id - Delete user
router.delete('/:id', userController.deleteUser);
// GET /api/users/nickname/:nickname/next-task - Get next task for user
router.get('/nickname/:nickname/next-task', userController.getNextTaskByNickname);
module.exports = router;
