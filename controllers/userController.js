const User = require('../models/User');

// Create a doctor account
exports.createDoctor = async (req, res) => {
  try {
    const { name, email, password, specialization, availableSlots } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Create new doctor
    const doctor = new User({
      name,
      email,
      password,
      role: 'doctor',
      specialization,
      availableSlots: availableSlots || []
    });
    
    await doctor.save();
    
    // Generate token for the new doctor
    const token = doctor.generateAuthToken();
    
    res.status(201).json({
      message: 'Doctor account created successfully',
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        role: doctor.role,
        specialization: doctor.specialization
      },
      token
    });
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Get only regular users (not doctors or admins)
    const users = await User.find({ role: 'user' })
      .select('-password -__v');
    
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all doctors
exports.getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' })
      .select('-password -__v');
    
    res.status(200).json({ doctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get public filtered doctors with pagination, search and specialization filtering
exports.getPublicFilteredDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', specialization = '' } = req.query;
    
    // Build query
    let query = { role: 'doctor' };
    
    // Add specialization filter if provided
    if (specialization) {
      query.specialization = specialization;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query
    const doctors = await User.find(query)
      .select('-password -__v')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      doctors,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      totalResults: total
    });
    
  } catch (error) {
    console.error('Error fetching public filtered doctors:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get filtered users with pagination, search and role filtering (admin only)
exports.getFilteredUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '' } = req.query;
    
    // Build query
    let query = {};
    
    // Add role filter if provided
    if (role) {
      query.role = role;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query
    const users = await User.find(query)
      .select('-password -__v')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      users,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      totalResults: total
    });
    
  } catch (error) {
    console.error('Error fetching filtered users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get filtered doctors with pagination, search and specialization filtering (admin only)
exports.getFilteredDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', specialization = '' } = req.query;
    
    // Build query
    let query = { role: 'doctor' };
    
    // Add specialization filter if provided
    if (specialization) {
      query.specialization = specialization;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query
    const doctors = await User.find(query)
      .select('-password -__v')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      doctors,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      totalResults: total
    });
    
  } catch (error) {
    console.error('Error fetching filtered doctors:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all available appointments (for admin)
exports.getAllAvailableAppointments = async (req, res) => {
  try {
    const doctors = await User.find({ 
      role: 'doctor',
      availableSlots: { $exists: true, $not: { $size: 0 } }
    }).select('name email specialization availableSlots');
    
    const appointments = doctors.map(doctor => ({
      doctorId: doctor._id,
      doctorName: doctor.name,
      specialization: doctor.specialization,
      email: doctor.email,
      availableSlots: doctor.availableSlots
    }));
    
    res.status(200).json({ appointments });
  } catch (error) {
    console.error('Error fetching available appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 