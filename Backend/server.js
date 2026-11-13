
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});
// Home API
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Courier System Backend is Running!"
  });
});

// Parcel API
const parcelRoutes = require("./routes/parcelRoutes");
app.use("/api/parcels", parcelRoutes);

// Admin and Driver Authentication API
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Admin Protected Routes
const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

// Driver Protected Routes
const driverRoutes = require("./routes/driverRoutes");
app.use("/api/driver", driverRoutes);

// MongoDB Connection
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Smart Courier Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });
