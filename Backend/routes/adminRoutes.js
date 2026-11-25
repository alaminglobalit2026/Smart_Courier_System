
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("../models/User");
const Parcel = require("../models/Parcel");
const { protect, authorize } = require("../middleware/authMiddleware");

// =====================================
// COMMON ERROR HANDLER
// =====================================
const handleError = (res, error, action) => {
  console.error(`${action} Error:`, error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "This email is already registered."
    });
  }

  return res.status(500).json({
    success: false,
    message: `${action} failed.`,
    error: process.env.NODE_ENV === "development"
      ? error.message
      : undefined
  });
};

// =====================================
// ADMIN DASHBOARD
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
    handleError(res, error, "Dashboard");
  }
});

// =====================================
// GET ALL DRIVERS
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
    handleError(res, error, "Driver list");
  }
});

// =====================================
// CREATE DRIVER
// POST /api/admin/drivers
// =====================================
router.post("/drivers", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
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

    const normalizedEmail = email.trim().toLowerCase();

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
      phone: typeof phone === "string" ? phone.trim() : "",
      role: "driver",
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Driver account created successfully!",
      driver: {
        id: driver._id,
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        role: driver.role,
        isActive: driver.isActive
      }
    });
  } catch (error) {
    handleError(res, error, "Driver creation");
  }
});

// =====================================
// DRIVER ROUTE DEBUG MIDDLEWARE
// =====================================
router.use("/drivers/:id", (req, res, next) => {
  console.log(
    "ADMIN DRIVER ROUTE MATCHED:",
    req.method,
    req.originalUrl,
    "ID:",
    req.params.id
  );
  next();
});

// =====================================
// EDIT DRIVER
// PUT /api/admin/drivers/:id
// =====================================
router.put(
  "/drivers/:id",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, password } = req.body;

      console.log("DRIVER EDIT HANDLER HIT:", id);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid driver ID."
        });
      }

      const driver = await User.findOne({
        _id: id,
        role: "driver"
      });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found. Check the driver ID."
        });
      }

      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
          return res.status(400).json({
            success: false,
            message: "Driver name cannot be empty."
          });
        }

        driver.name = name.trim();
      }

      if (email !== undefined) {
        if (typeof email !== "string" || !email.trim()) {
          return res.status(400).json({
            success: false,
            message: "Email cannot be empty."
          });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: id }
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "This email is already registered."
          });
        }

        driver.email = normalizedEmail;
      }

      if (phone !== undefined) {
        if (typeof phone !== "string") {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number."
          });
        }

        driver.phone = phone.trim();
      }

      if (password !== undefined && password !== "") {
        if (typeof password !== "string" || password.length < 8) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters."
          });
        }

        // User.js save hook hashes the password.
        driver.password = password;
      }

      await driver.save();

      console.log("DRIVER UPDATED SUCCESSFULLY:", id);

      res.status(200).json({
        success: true,
        message: "Driver updated successfully!",
        driver: {
          id: driver._id,
          _id: driver._id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          role: driver.role,
          isActive: driver.isActive
        }
      });
    } catch (error) {
      handleError(res, error, "Driver update");
    }
  }
);

// =====================================
// DELETE DRIVER
// DELETE /api/admin/drivers/:id
// =====================================
router.delete(
  "/drivers/:id",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log("DRIVER DELETE HANDLER HIT:", id);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid driver ID."
        });
      }

      const driver = await User.findOne({
        _id: id,
        role: "driver"
      });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found. Check the driver ID."
        });
      }

      const assignedParcels = await Parcel.countDocuments({
        assignedDriver: driver._id
      });

      if (assignedParcels > 0) {
        return res.status(400).json({
          success: false,
          message: `This driver has ${assignedParcels} assigned parcel(s). Reassign the parcels before deleting this driver.`
        });
      }

      await User.deleteOne({
        _id: driver._id,
        role: "driver"
      });

      console.log("DRIVER DELETED SUCCESSFULLY:", id);

      res.status(200).json({
        success: true,
        message: "Driver deleted successfully!"
      });
    } catch (error) {
      handleError(res, error, "Driver deletion");
    }
  }
);

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
    handleError(res, error, "Parcel list");
  }
});

// =====================================
// EDIT PARCEL
// PUT /api/admin/parcels/:id
// =====================================
router.put("/parcels/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parcel ID."
      });
    }

    const parcel = await Parcel.findById(id);

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found."
      });
    }

    const allowedFields = [
      "senderName",
      "senderPhone",
      "receiverName",
      "receiverPhone",
      "pickupAddress",
      "deliveryAddress",
      "parcelDescription",
      "weightKg"
    ];

    for (const field of allowedFields) {
      if (req.body[field] === undefined) continue;

      if (field === "weightKg") {
        const weight = Number(req.body.weightKg);

        if (!Number.isFinite(weight) || weight < 0.1) {
          return res.status(400).json({
            success: false,
            message: "Weight must be at least 0.1 KG."
          });
        }

        parcel.weightKg = weight;
      } else {
        if (
          typeof req.body[field] !== "string" ||
          !req.body[field].trim()
        ) {
          return res.status(400).json({
            success: false,
            message: `${field} cannot be empty.`
          });
        }

        parcel[field] = req.body[field].trim();
      }
    }

    await parcel.save();

    res.status(200).json({
      success: true,
      message: "Parcel updated successfully!",
      parcel
    });
  } catch (error) {
    handleError(res, error, "Parcel update");
  }
});

// =====================================
// DELETE PARCEL
// DELETE /api/admin/parcels/:id
// =====================================
router.delete("/parcels/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parcel ID."
      });
    }

    const parcel = await Parcel.findById(id);

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found."
      });
    }

    await Parcel.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: "Parcel deleted successfully!"
    });
  } catch (error) {
    handleError(res, error, "Parcel deletion");
  }
});

// =====================================
// ASSIGN PARCEL TO DRIVER
// PUT /api/admin/assign-parcel
// =====================================
router.put("/assign-parcel", protect, authorize("admin"), async (req, res) => {
  try {
    const { trackingNumber, driverId } = req.body;

    if (
      typeof trackingNumber !== "string" ||
      !trackingNumber.trim() ||
      !driverId
    ) {
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
    handleError(res, error, "Parcel assignment");
  }
});

module.exports = router;
