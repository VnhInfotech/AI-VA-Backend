const express = require('express');
const router = express.Router();
const { OpenAI } = require("openai");
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateCaptionPrompt = (topic) => {
  const formatted = topic.trim();
  return `Create 3 professional, thoughtful LinkedIn captions and 3 creative, emoji-friendly captions for Instagram/Facebook/X about "${formatted}". Generate relevant hashtags. Return only a flat JSON array of captions as strings and no extra fields.`;
};

router.post('/generate-captions', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required and must be a non-empty string.' });
  }

  const captionPrompt = generateCaptionPrompt(prompt);

  try {
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: captionPrompt }],
      max_tokens: 1000,
      temperature: 0.8,
    });

    const rawText = chatResponse.choices[0].message.content;

    // extract JSON array from response
    const jsonMatch = rawText.match(/\[.*\]/s);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const captions = JSON.parse(jsonMatch[0]);

    res.json({ captions });

  } catch (error) {
    console.error("Caption generation error:", error?.response?.data || error.message);
    res.status(500).json({
      error: error?.response?.data?.error?.message || 'OpenAI caption generation failed.',
    });
  }
});

module.exports = router;
