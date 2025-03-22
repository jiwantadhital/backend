const express = require("express");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { auth, authorize } = require("../middleware/auth");
const mongoose = require("mongoose");

const router = express.Router();

// 📌 Doctor - Add available appointment slots
router.post("/available-slots", auth, authorize("doctor"), async (req, res) => {
  try {
    const { date, times } = req.body;
    const doctorId = req.user.id;

    // Find the doctor user
    const doctor = await User.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if there's already a slot for this date
    const existingSlotIndex = doctor.availableSlots.findIndex(
      slot => slot.date === date
    );

    if (existingSlotIndex >= 0) {
      // Update existing slot
      doctor.availableSlots[existingSlotIndex].times = times;
    } else {
      // Add new slot
      doctor.availableSlots.push({ date, times });
    }

    await doctor.save();

    res.status(201).json({ 
      message: "Appointment slots added successfully", 
      availableSlots: doctor.availableSlots 
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding appointment slots", error: error.message });
  }
});

// 📌 Get available doctors and their slots
router.get("/available-doctors", auth, async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor", availableSlots: { $exists: true, $not: { $size: 0 } } })
      .select("name specialization availableSlots");

    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching available doctors", error: error.message });
  }
});

// 📌 User - Book an appointment
router.post("/book", auth, authorize("user", "admin"), async (req, res) => {
  try {
    const { doctorId, date, time, reason } = req.body;
    const userId = req.user.id;

    // Verify the doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      return res.status(400).json({ message: "Invalid doctor" });
    }

    // Check if the doctor has the requested slot available
    const dateSlot = doctor.availableSlots.find(slot => slot.date === date);
    if (!dateSlot || !dateSlot.times.includes(time)) {
      return res.status(400).json({ message: "This slot is not available" });
    }

    // Check if the appointment slot is already booked
    const existingAppointment = await Appointment.findOne({ 
      doctor: doctorId,
      date, 
      time,
      status: { $in: ["pending", "confirmed"] }
    });
    
    if (existingAppointment) {
      return res.status(400).json({ message: "This slot is already booked. Please choose another time." });
    }

    // Create new appointment
    const newAppointment = new Appointment({ 
      user: userId, 
      doctor: doctorId, 
      date, 
      time, 
      reason 
    });
    
    await newAppointment.save();

    res.status(201).json({ 
      message: "Appointment booked successfully! Waiting for doctor's confirmation.", 
      appointment: newAppointment 
    });
  } catch (error) {
    res.status(500).json({ message: "Error booking appointment", error: error.message });
  }
});

// 📌 Doctor - Update appointment status (confirm/reject)
router.patch("/:id/status", auth, authorize("doctor"), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const doctorId = req.userId;
    
    if (!["confirmed", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify this appointment belongs to the doctor
    // if (String(appointment.doctor) !== String(doctorId)) {
    //   return res.status(403).json({ message: "You are not authorized to update this appointment" });
    // }

    appointment.status = status;
    if (notes) appointment.notes = notes;
    
    await appointment.save();

    res.status(200).json({ 
      message: `Appointment ${status}`, 
      appointment 
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating appointment status", error: error.message });
  }
});

// 📌 User - Cancel an appointment
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const userId = req.userId;
    
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify this appointment belongs to the user or the user is a doctor/admin
    if (appointment.user.toString() !== userId && 
        req.userRole !== "admin" && 
        (req.userRole === "doctor" && appointment.doctor.toString() !== userId)) {
      return res.status(403).json({ message: "You are not authorized to cancel this appointment" });
    }

    // Only allow cancellation of pending or confirmed appointments
    if (!["pending", "confirmed"].includes(appointment.status)) {
      return res.status(400).json({ message: `Cannot cancel an appointment that is already ${appointment.status}` });
    }

    appointment.status = "canceled";
    await appointment.save();

    res.status(200).json({ 
      message: "Appointment canceled successfully", 
      appointment 
    });
  } catch (error) {
    res.status(500).json({ message: "Error canceling appointment", error: error.message });
  }
});

// 📌 Get all user's appointments
router.get("/my-appointments", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    
    let query = {};
    
    // If user is patient, get their appointments
    if (userRole === "user") {
      query.user = userId;
    } 
    // If user is doctor, get appointments they need to handle
    else if (userRole === "doctor") {
      query.doctor = userId;
    }
    // Admin can see all appointments

    const appointments = await Appointment.find(query)
      .populate("user", "name email")
      .populate("doctor", "name specialization")
      .sort({ createdAt: -1 });

    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching appointments", error: error.message });
  }
});

// 📌 Admin - Get all appointments
router.get("/all", auth, authorize("admin"), async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("user", "name email")
      .populate("doctor", "name specialization")
      .sort({ createdAt: -1 });
      
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching appointments", error: error.message });
  }
});

// 📌 Admin - Get all appointments with pagination, filtering, and detailed information
router.get("/admin/detailed", auth, authorize("admin"), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
      doctorId = '', 
      fromDate = '', 
      toDate = '' 
    } = req.query;
    
    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build the aggregation pipeline
    const pipeline = [];
    
    // Add lookup stages to get user and doctor details
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'doctor',
          foreignField: '_id',
          as: 'doctorData'
        }
      },
      {
        $unwind: '$userData'
      },
      {
        $unwind: '$doctorData'
      }
    );
    
    // Build the match stage for filtering
    const matchStage = {};
    
    // Add status filter if provided
    if (status) {
      matchStage.status = status;
    }
    
    // Add doctor filter if provided
    if (doctorId) {
      matchStage.doctor = mongoose.Types.ObjectId(doctorId);
    }
    
    // Add date range filter if provided
    if (fromDate && toDate) {
      matchStage.date = { $gte: fromDate, $lte: toDate };
    } else if (fromDate) {
      matchStage.date = { $gte: fromDate };
    } else if (toDate) {
      matchStage.date = { $lte: toDate };
    }
    
    // Add search filter if provided (search in multiple fields)
    if (search) {
      matchStage.$or = [
        { reason: { $regex: search, $options: 'i' } },
        { 'userData.name': { $regex: search, $options: 'i' } },
        { 'userData.email': { $regex: search, $options: 'i' } },
        { 'doctorData.name': { $regex: search, $options: 'i' } },
        { 'doctorData.email': { $regex: search, $options: 'i' } },
        { 'doctorData.specialization': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add the match stage if we have filters
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }
    
    // Add count facet for pagination
    pipeline.push(
      {
        $facet: {
          totalCount: [{ $count: 'count' }],
          paginatedResults: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                date: 1,
                time: 1,
                status: 1,
                notes: 1,
                reason: 1,
                createdAt: 1,
                updatedAt: 1,
                user: {
                  _id: '$userData._id',
                  name: '$userData.name',
                  email: '$userData.email',
                  role: '$userData.role'
                },
                doctor: {
                  _id: '$doctorData._id',
                  name: '$doctorData.name',
                  email: '$doctorData.email',
                  specialization: '$doctorData.specialization'
                }
              }
            }
          ]
        }
      }
    );
    
    // Execute the aggregation
    const result = await Appointment.aggregate(pipeline);
    
    // Extract the results
    const totalResults = result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;
    const appointments = result[0].paginatedResults;
    
    res.status(200).json({
      appointments,
      totalPages: Math.ceil(totalResults / limitNum),
      currentPage: pageNum,
      totalResults
    });
  } catch (error) {
    console.error('Error fetching detailed appointments:', error);
    res.status(500).json({ message: "Error fetching appointments", error: error.message });
  }
});

// 📌 Admin - Get appointment statistics for dashboard
router.get("/admin/statistics", auth, authorize("admin"), async (req, res) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Get counts of appointments by status
    const statusCounts = await Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get count of today's appointments
    const todayAppointments = await Appointment.countDocuments({
      date: today
    });
    
    // Get count of appointments by doctor
    const appointmentsByDoctor = await Appointment.aggregate([
      {
        $group: {
          _id: "$doctor",
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "doctorInfo"
        }
      },
      {
        $unwind: "$doctorInfo"
      },
      {
        $project: {
          doctorId: "$_id",
          doctorName: "$doctorInfo.name",
          specialization: "$doctorInfo.specialization",
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5 // Get top 5 doctors
      }
    ]);
    
    // Get count of recent appointments (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const last7DaysStr = last7Days.toISOString().split('T')[0];
    
    const recentAppointments = await Appointment.aggregate([
      {
        $match: {
          date: { $gte: last7DaysStr }
        }
      },
      {
        $group: {
          _id: "$date",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Format the status counts into an object
    const formattedStatusCounts = {};
    statusCounts.forEach(item => {
      formattedStatusCounts[item._id] = item.count;
    });
    
    // Get total appointment count
    const totalAppointments = await Appointment.countDocuments();
    
    res.status(200).json({
      totalAppointments,
      todayAppointments,
      statusCounts: formattedStatusCounts,
      topDoctors: appointmentsByDoctor,
      recentAppointments
    });
    
  } catch (error) {
    console.error('Error fetching appointment statistics:', error);
    res.status(500).json({ message: "Error fetching appointment statistics", error: error.message });
  }
});

// 📌 Get appointment details
router.get("/:id", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    
    const appointment = await Appointment.findById(req.params.id)
      .populate("user", "name email")
      .populate("doctor", "name specialization");
      
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Check permissions - user can only see their own appointments
    if (userRole === "user" && appointment.user._id.toString() !== String(userId)) {
      return res.status(403).json({ message: "You don't have permission to view this appointment" });
    }
    
    // Doctor can only see appointments assigned to them
    if (userRole === "doctor" && appointment.doctor._id.toString() !== String(userId)) {
      return res.status(403).json({ message: "You don't have permission to view this appointment" });
    }

    res.status(200).json(appointment);
  } catch (error) {
    res.status(500).json({ message: "Error fetching appointment details", error: error.message });
  }
});

module.exports = router;
