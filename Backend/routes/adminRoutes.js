
const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Parcel = require("../models/Parcel");
const { protect, authorize } = require("../middleware/authMiddleware");

// ADMIN DASHBOARD
router.get("/dashboard", protect, authorize("admin"), (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Admin Dashboard!",
    user: {
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// CREATE DRIVER ACCOUNT
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

// ASSIGN PARCEL TO DRIVER (ADMIN ONLY)
router.put("/assign-parcel", protect, authorize("admin"), async (req, res) => {
  try {
    const { trackingNumber, driverId } = req.body;

    if (!trackingNumber || !driverId) {
      return res.status(400).json({
        success: false,
        message: "Tracking number and driver ID are required."
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

    const parcel = await Parcel.findOne({ trackingNumber });

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found."
      });
    }

    if (parcel.status === "delivered" || parcel.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This parcel cannot be assigned."
      });
    }

    parcel.assignedDriver = driver._id;
    await parcel.save();

    res.json({
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
