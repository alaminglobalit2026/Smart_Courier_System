
const express = require("express");
const router = express.Router();

const Parcel = require("../models/Parcel");
const { protect, authorize } = require("../middleware/authMiddleware");

// =====================================
// DRIVER DASHBOARD
// =====================================
router.get("/dashboard", protect, authorize("driver"), (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Driver Dashboard!",
    driver: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || "",
      profileImage: req.user.profileImage || "",
      role: req.user.role
    }
  });
});

// =====================================
// GET DRIVER'S ASSIGNED PARCELS
// =====================================
router.get("/my-parcels", protect, authorize("driver"), async (req, res) => {
  try {
    const driverId = req.user._id;

    console.log("========== DRIVER PARCEL DEBUG ==========");
    console.log("LOGGED-IN DRIVER ID:", driverId.toString());
    console.log("DRIVER NAME:", req.user.name);

    const parcels = await Parcel.find({
      assignedDriver: driverId
    }).select(
      "trackingNumber senderName receiverName pickupAddress deliveryAddress parcelDescription productImage status locationSharingEnabled driverLocation createdAt"
    );

    console.log("ASSIGNED PARCELS COUNT:", parcels.length);
    console.log("=========================================");

    res.json({
      success: true,
      count: parcels.length,
      parcels
    });

  } catch (error) {
    console.error("Driver parcels error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to load assigned parcels."
    });
  }
});

// =====================================
// UPDATE PARCEL STATUS
// =====================================
router.put("/update-status", protect, authorize("driver"), async (req, res) => {
  try {
    const { trackingNumber, status } = req.body;

    const allowedStatuses = [
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered"
    ];

    if (!trackingNumber || !status) {
      return res.status(400).json({
        success: false,
        message: "Tracking number and status are required."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parcel status."
      });
    }

    const parcel = await Parcel.findOne({
      trackingNumber,
      assignedDriver: req.user._id
    });

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Assigned parcel not found."
      });
    }

    if (["delivered", "cancelled"].includes(parcel.status)) {
      return res.status(400).json({
        success: false,
        message: "This parcel can no longer be updated."
      });
    }

    parcel.status = status;
    await parcel.save();

    res.json({
      success: true,
      message: "Parcel status updated successfully!",
      parcel: {
        trackingNumber: parcel.trackingNumber,
        status: parcel.status,
        productImage: parcel.productImage || ""
      }
    });

  } catch (error) {
    console.error("Status update error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update parcel status."
    });
  }
});

// =====================================
// ENABLE OR DISABLE GPS SHARING
// =====================================
router.put("/location-sharing", protect, authorize("driver"), async (req, res) => {
  try {
    const { trackingNumber, enabled } = req.body;

    if (!trackingNumber || typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Tracking number and sharing permission are required."
      });
    }

    const parcel = await Parcel.findOne({
      trackingNumber,
      assignedDriver: req.user._id
    });

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Assigned parcel not found."
      });
    }

    if (["delivered", "cancelled"].includes(parcel.status) && enabled) {
      return res.status(400).json({
        success: false,
        message: "GPS sharing is unavailable for completed parcels."
      });
    }

    parcel.locationSharingEnabled = enabled;

    if (!enabled) {
      parcel.driverLocation = {
        latitude: null,
        longitude: null,
        updatedAt: null
      };
    }

    await parcel.save();

    res.json({
      success: true,
      message: enabled
        ? "GPS sharing enabled successfully."
        : "GPS sharing disabled successfully.",
      locationSharingEnabled: parcel.locationSharingEnabled
    });

  } catch (error) {
    console.error("GPS sharing error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update GPS sharing."
    });
  }
});

// =====================================
// UPDATE DRIVER GPS LOCATION
// =====================================
router.put("/update-location", protect, authorize("driver"), async (req, res) => {
  try {
    const { trackingNumber, latitude, longitude } = req.body;

    if (
      !trackingNumber ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid tracking number, latitude and longitude are required."
      });
    }

    const parcel = await Parcel.findOne({
      trackingNumber,
      assignedDriver: req.user._id
    });

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Assigned parcel not found."
      });
    }

    if (!parcel.locationSharingEnabled) {
      return res.status(403).json({
        success: false,
        message: "Please enable GPS sharing first."
      });
    }

    if (["delivered", "cancelled"].includes(parcel.status)) {
      return res.status(400).json({
        success: false,
        message: "Location updates are unavailable for this parcel."
      });
    }

    parcel.driverLocation = {
      latitude,
      longitude,
      updatedAt: new Date()
    };

    await parcel.save();

    res.json({
      success: true,
      message: "Driver location updated successfully!",
      driverLocation: parcel.driverLocation
    });

  } catch (error) {
    console.error("GPS location error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update driver location."
    });
  }
});

module.exports = router;
