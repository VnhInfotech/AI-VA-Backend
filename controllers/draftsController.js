const draftPost = require('../models/PostDraftOrSchedule');

exports.getDrafts = async (req, res) => {
    try {
      const drafts = await draftPost.find({
        user: req.user.id,
        isDraft: true,
      });
  
      res.status(200).json({ drafts });
    } catch (error) {
      console.error("Error in getDrafts:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  
  exports.saveDraft = async (req, res) => {
    try {
      const { imageUrl, content, generatedPostId } = req.body;
  
      const newDraft = new draftPost({
        user: req.user.id,
        imageUrl,
        content,
        isDraft: true,
        generatedPostId,
      });
  
      await newDraft.save();
  
      res.status(201).json({ message: "Draft saved", draft: newDraft });
    } catch (error) {
      console.error("Error in saveDraft:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  
  exports.markDraftAsPosted = async (req, res) => {
      try {
        const { id } = req.params;
    
        const updatedDraft = await draftPost.findOneAndUpdate(
          {
            _id: id,
            user: req.user.id,
            isDraft: true,
          },
          {
            $set: {
              isDraft: false,
              isSent: true,
              status: "posted",
              // platform : req.platform; // check
            },
          },
          { new: true }
        );
    
        if (!updatedDraft) {
          return res.status(404).json({ error: "Draft not found or already posted" });
        }
    
        res.status(200).json({ message: "Draft marked as posted", draft: updatedDraft });
      } catch (err) {
        console.error("Error in markDraftAsPosted:", err);
        res.status(500).json({ error: "Server error" });
      }
    };