const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Upload profile picture (base64)
exports.uploadProfilePicture = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ message: "No image provided" });

    const user = await User.findById(req.user._id);
    user.profilePicture = image;
    await user.save();

    res.status(200).json({ profilePicture: user.profilePicture });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Failed to upload profile picture" });
  }
};

// Update name, email, profileImage
exports.updateProfile = async (req, res) => {
    try {
      const { name, email, profileImage } = req.body;
      const user = await User.findById(req.user._id);
  
      // Check if user exists
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Only update fields that were provided in the request
      if (name) user.name = name;
      if (email) user.email = email;
      if (profileImage) user.profilePicture = profileImage;
  
      // Save the updated user
      await user.save();
      res.status(200).json({ message: "Profile updated successfully" });
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  };
  
// Change password
exports.changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id);
  
      // Check if user exists
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Check if the user is a Google user (who doesn't have a password)
      if (!user.password) {
        return res.status(400).json({ message: "Password change not allowed for Google users" });
      }
  
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
  
      // Hash the new password and save it
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();
  
      res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
      console.error("Password update error:", err);
      res.status(500).json({ message: "Failed to update password" });
    }
  };
  