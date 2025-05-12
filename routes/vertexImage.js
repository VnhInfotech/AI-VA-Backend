const express = require('express');
const router = express.Router();
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
require('dotenv').config();

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = process.env.GOOGLE_LOCATION;
const MODEL_VERSION = process.env.GOOGLE_MODEL_VERSION;

const imagenResults = {};
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const imagesFolder = path.join(__dirname, '../generated_images');
fs.mkdirSync(imagesFolder, { recursive: true });

router.post('/generate-image-async', async (req, res) => {
  const { prompt, sampleCount = 3, aspectRatio = '1:1' } = req.body; // make dynamic once pricing plans are decided

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: 'Prompt is required and must be non-empty' });
  }

  const enhancedPrompt = `Create an engaging image with a line that says anything related to ${prompt.trim()}`;
  const requestId = uuidv4();

  res.status(202).json({ requestId });

  (async () => {
    try {
      const auth = new GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
      });

      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_VERSION}:predict`;

      const requestBody = {
        instances: [{ prompt: enhancedPrompt }],
        parameters: { sampleCount, aspectRatio }
      };

      // console.log(requestBody);
      const response = await axios.post(endpoint, requestBody, {
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
      });

      const predictions = response.data.predictions || [];
      const imageBase64s = predictions.map(prediction =>
        prediction.bytesBase64Encoded ||
        prediction.structValue?.fields?.bytesBase64Encoded?.stringValue
      );

      const imagePaths = [];

      for (let i = 0; i < imageBase64s.length; i++) {
        const base64 = imageBase64s[i];
        const filename = `vertex_${Date.now()}_${i}`;
        const filePath = path.join(imagesFolder, `${filename}.png`);
        const buffer = Buffer.from(base64, 'base64');

        fs.writeFileSync(filePath, buffer);

        const publicPath = `generated_images/${filename}.png`; 
        imagePaths.push(publicPath);
      }

      imagenResults[requestId] = { imagePaths };
    } catch (error) {
      console.error("Imagen generation failed:", error?.response?.data || error.message);
      imagenResults[requestId] = { error: 'Generation failed' };
    }
  })();
});

router.get('/check-image-result/:requestId', (req, res) => {
  const { requestId } = req.params;
  const result = imagenResults[requestId];

  if (!result) return res.status(202).json({ status: 'pending' });

  if (result.error) return res.status(500).json({ error: result.error });

  return res.json({ imagePaths: result.imagePaths });

});


module.exports = router;
