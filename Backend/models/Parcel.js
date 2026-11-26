
const mongoose = require("mongoose");
const crypto = require("crypto");

const notificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending"
    },
    sentAt: {
      type: Date,
      default: null
    },
    error: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const parcelSchema = new mongoose.Schema(
  {
    trackingNumber: {
      type: String,
      unique: true,
      required: true
    },

    senderName: {
      type: String,
      required: true,
      trim: true
    },

    senderPhone: {
      type: String,
      required: true
    },

    receiverName: {
      type: String,
      required: true,
      trim: true
    },

    receiverPhone: {
      type: String,
      required: true
    },

    pickupAddress: {
      type: String,
      required: true
    },

    deliveryAddress: {
      type: String,
      required: true
    },

    parcelDescription: {
      type: String,
      required: true
    },

    weightKg: {
      type: Number,
      required: true,
      min: 0.1
    },

    // Product picture URL
    productImage: {
      type: String,
      default: ""
    },

    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0
    },

    // Payment information
    payment: {
      type: mongoose.Schema.Types.Mixed,
      default: "pending"
    },

    // Parcel delivery status
    status: {
      type: String,
      enum: [
        "pending",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "cancelled"
      ],
      default: "pending"
    },

    // Assigned delivery driver
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Driver GPS sharing
    locationSharingEnabled: {
      type: Boolean,
      default: false
    },

    // GPS coordinates and update information
    driverLocation: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    // Notification information
    notification: {
      type: notificationSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

// Automatically generate tracking number
parcelSchema.pre("validate", function () {
  if (!this.trackingNumber) {
    this.trackingNumber =
      "SC" + crypto.randomBytes(5).toString("hex").toUpperCase();
  }
});

module.exports = mongoose.model("Parcel", parcelSchema);
