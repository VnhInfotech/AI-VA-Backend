const express = require('express');
const router = express.Router();
const { OpenAI } = require("openai");
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/generate-dalle-image', async (req, res) => {
  const { prompt, size = "1024x1024" ,n = 1  } = req.body;
  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: 'Prompt is required and must be non-empty' });
  }

  if (typeof n !== "number" || n < 1 || n > 10) {
    return res.status(400).json({ error: 'n must be a number between 1 and 10' });
  }
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Create an engaging image with a line that says anything related to ${prompt.trim()}`,
      size,
    });

    const imageUrls = response.data.map(img => img.url);
    return res.json({ imageUrls });

  } catch (error) {
    console.error("DALL·E generation error:", error?.response?.data || error.message);
    return res.status(500).json({
      error: error?.response?.data?.error?.message || 'DALL·E image generation failed',
    });
  }
});

module.exports = router;
