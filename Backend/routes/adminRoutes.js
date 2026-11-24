
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("../models/User");
const Parcel = require("../models/Parcel");
const { protect, authorize } = require("../middleware/authMiddleware");

// =====================================
// ADMIN DASHBOARD STATISTICS
// GET /api/admin/dashboard
// =====================================
router.get("/dashboard", protect, authorize("admin"), async (req, res) => {
  try {
    const [
      totalUsers,
      totalParcels,
      pendingParcels,
      deliveredParcels,
      activeDrivers
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      Parcel.countDocuments(),
      Parcel.countDocuments({ status: "pending" }),
      Parcel.countDocuments({ status: "delivered" }),
      User.countDocuments({ role: "driver", isActive: true })
    ]);

    res.status(200).json({
      success: true,
      message: "Admin Dashboard Statistics",
      user: {
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      statistics: {
        totalUsers,
        totalParcels,
        pendingParcels,
        deliveredParcels,
        activeDrivers
      }
    });
  } catch (error) {
    console.error("Dashboard error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics."
    });
  }
});


// =====================================
// GET ALL ACTIVE DRIVERS
// GET /api/admin/drivers
// =====================================
router.get("/drivers", protect, authorize("admin"), async (req, res) => {
  try {
    const drivers = await User.find({
      role: "driver",
      isActive: true
    })
      .select("name email phone role isActive createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: drivers.length,
      drivers
    });
  } catch (error) {
    console.error("Driver list error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load drivers."
    });
  }
});


// =====================================
// CREATE DRIVER ACCOUNT
// POST /api/admin/drivers
// =====================================
router.post("/drivers", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters."
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered."
      });
    }

    const driver = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone || "",
      role: "driver"
    });

    res.status(201).json({
      success: true,
      message: "Driver account created successfully!",
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        role: driver.role
      }
    });
  } catch (error) {
    console.error("Driver creation error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create driver account."
    });
  }
});


// =====================================
// GET ALL PARCELS
// GET /api/admin/parcels
// =====================================
router.get("/parcels", protect, authorize("admin"), async (req, res) => {
  try {
    const parcels = await Parcel.find()
      .populate("assignedDriver", "name email phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: parcels.length,
      parcels
    });
  } catch (error) {
    console.error("Parcel list error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load parcels."
    });
  }
});


// =====================================
// ASSIGN PARCEL TO DRIVER
// PUT /api/admin/assign-parcel
// =====================================
router.put("/assign-parcel", protect, authorize("admin"), async (req, res) => {
  try {
    const { trackingNumber, driverId } = req.body;

    if (!trackingNumber || !driverId) {
      return res.status(400).json({
        success: false,
        message: "Tracking number and driver ID are required."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID."
      });
    }

    const driver = await User.findOne({
      _id: driverId,
      role: "driver",
      isActive: true
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Active driver not found."
      });
    }

    const parcel = await Parcel.findOne({
      trackingNumber: trackingNumber.trim().toUpperCase()
    });

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found."
      });
    }

    if (["delivered", "cancelled"].includes(parcel.status)) {
      return res.status(400).json({
        success: false,
        message: "This parcel cannot be assigned."
      });
    }

    parcel.assignedDriver = driver._id;
    await parcel.save();

    res.status(200).json({
      success: true,
      message: "Parcel assigned to driver successfully!",
      parcel: {
        trackingNumber: parcel.trackingNumber,
        assignedDriver: {
          id: driver._id,
          name: driver.name,
          email: driver.email
        },
        status: parcel.status
      }
    });
  } catch (error) {
    console.error("Parcel assignment error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to assign parcel."
    });
  }
});

module.exports = router;
