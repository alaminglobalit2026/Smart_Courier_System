const express = require("express");
const Parcel = require("../models/Parcel");
const upload = require("../middleware/uploadMiddleware");
const uploadImage = require("../services/imageUploadService");

const router = express.Router();

// CUSTOMER: CREATE PARCEL BOOKING WITHOUT LOGIN
// Supports optional product image upload
router.post("/book", upload.single("productImage"), async (req, res) => {
  try {
    const {
      senderName,
      senderPhone,
      receiverName,
      receiverPhone,
      pickupAddress,
      deliveryAddress,
      parcelDescription,
      weightKg
    } = req.body;

    if (
      !senderName ||
      !senderPhone ||
      !receiverName ||
      !receiverPhone ||
      !pickupAddress ||
      !deliveryAddress ||
      !parcelDescription ||
      weightKg === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required parcel information."
      });
    }

    const weight = Number(weightKg);

    if (!Number.isFinite(weight) || weight < 0.1) {
      return res.status(400).json({
        success: false,
        message: "Parcel weight must be at least 0.1 kg."
      });
    }

    // Upload image only when a file is selected
    let productImage = "";

    if (req.file) {
      productImage = await uploadImage(
        req.file,
        "smart-courier/products"
      );
    }

    const parcel = await Parcel.create({
      senderName,
      senderPhone,
      receiverName,
      receiverPhone,
      pickupAddress,
      deliveryAddress,
      parcelDescription,
      weightKg: weight,
      productImage
    });

    res.status(201).json({
      success: true,
      message: "Parcel booked successfully!",
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      productImage: parcel.productImage,
      createdAt: parcel.createdAt
    });

  } catch (error) {
    console.error("Booking error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message || "Unable to book parcel. Please try again."
    });
  }
});


// CUSTOMER: TRACK PARCEL USING TRACKING NUMBER AND RECEIVER PHONE
router.get("/track/:trackingNumber", async (req, res) => {
  try {
    const trackingNumber =
      req.params.trackingNumber.toUpperCase();

    const { receiverPhone } = req.query;

    if (!receiverPhone) {
      return res.status(400).json({
        success: false,
        message: "Receiver phone number is required."
      });
    }

    const parcel = await Parcel.findOne({
      trackingNumber,
      receiverPhone
    }).select(
      "trackingNumber status parcelDescription productImage createdAt updatedAt"
    );

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found. Please check your tracking number and receiver phone."
      });
    }

    res.json({
      success: true,
      message: "Parcel found successfully.",
      parcel
    });

  } catch (error) {
    console.error("Tracking error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to track parcel. Please try again."
    });
  }
});


// CUSTOMER: LIVE GPS TRACKING
router.get("/live/:trackingNumber", async (req, res) => {
  try {
    const trackingNumber =
      req.params.trackingNumber.toUpperCase();

    const { receiverPhone } = req.query;

    if (!receiverPhone) {
      return res.status(400).json({
        success: false,
        message: "Receiver phone number is required."
      });
    }

    const parcel = await Parcel.findOne({
      trackingNumber,
      receiverPhone
    }).select(
      "trackingNumber receiverPhone status locationSharingEnabled driverLocation updatedAt"
    );

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found. Please check your details."
      });
    }

    if (!parcel.locationSharingEnabled) {
      return res.json({
        success: true,
        trackingNumber: parcel.trackingNumber,
        status: parcel.status,
        locationSharingEnabled: false,
        driverLocation: null,
        message: "Driver location sharing is currently disabled."
      });
    }

    res.json({
      success: true,
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      locationSharingEnabled: true,
      driverLocation: parcel.driverLocation
    });

  } catch (error) {
    console.error("Live tracking error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to load live tracking information."
    });
  }
});

module.exports = router;