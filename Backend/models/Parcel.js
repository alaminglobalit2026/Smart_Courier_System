
const mongoose = require("mongoose");
const crypto = require("crypto");

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

    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid"
    },

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

    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    locationSharingEnabled: {
      type: Boolean,
      default: false
    },

    driverLocation: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null
      },
      updatedAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

parcelSchema.pre("validate", function () {
  if (!this.trackingNumber) {
    this.trackingNumber =
      "SC" + crypto.randomBytes(5).toString("hex").toUpperCase();
  }
});

module.exports = mongoose.model("Parcel", parcelSchema);
