const userService = require('../services/userService');

class UserController {
  // Get all users
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      
      res.json({
        count: users.length,
        users
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user by ID
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }
      
      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  // Get current user (from session)
  async getCurrentUser(req, res, next) {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          error: 'Not authenticated'
        });
      }

      const user = await userService.getUserById(req.session.userId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }
      
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();