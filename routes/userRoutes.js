const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth, authorize } = require('../middleware/auth');

// Route to create a doctor account (admin only)
router.post('/doctors', auth, authorize('admin'), userController.createDoctor);

// Route to get all users (admin only)
router.get('/users', auth, authorize('admin'), userController.getAllUsers);

// Route to get all doctors
router.get('/doctors', userController.getAllDoctors);

// Route to get filtered doctors with pagination, search, and specialization filtering
router.get('/doctors/search', userController.getPublicFilteredDoctors);

// Admin routes
// Route to get all users with pagination, search, and role filtering (admin only)
router.get('/admin/users', auth, authorize('admin'), userController.getFilteredUsers);

// Route to get all doctors with pagination, search, and specialization filtering (admin only)
router.get('/admin/doctors', auth, authorize('admin'), userController.getFilteredDoctors);

// Route to get all available appointments (admin only)
router.get('/available-appointments', auth, authorize('admin'), 
  userController.getAllAvailableAppointments);

module.exports = router; 