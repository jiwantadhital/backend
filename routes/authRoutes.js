const express = require("express");
const User = require("../models/User");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, specialization } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create new user
    const userData = { name, email, password, role };
    
    // If role is doctor, add specialization
    if (role === "doctor" && specialization) {
      userData.specialization = specialization;
    }

    const user = new User(userData);
    await user.save();

    // Generate token
    const token = user.generateAuthToken();

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error: error.message });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate token
    const token = user.generateAuthToken();

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// Get current user profile
router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.role === "doctor" && { specialization: user.specialization }),
      ...(user.role === "doctor" && { availableSlots: user.availableSlots })
    });
  } catch (error) {
    res.status(500).json({ message: "Error getting user profile", error: error.message });
  }
});

// Admin only - Get all users
router.get("/users", auth, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
});

module.exports = router; 