const router = require('express').Router();
const User = require('../models/User');
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

// Get user profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Base64 image upload
router.post("/upload-profile-picture", authMiddleware, userController.uploadProfilePicture);

// Profile update
router.put("/update-profile", authMiddleware, userController.updateProfile);

// Password change
router.put("/change-password", authMiddleware, userController.changePassword);

module.exports = router; 