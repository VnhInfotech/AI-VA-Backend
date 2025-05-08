const express = require('express');
const router = express.Router();
const axios = require('axios');

const PIXABAY_API_KEY = "49868843-b071a54d5b4f26782fc1e1e83";
const PEXELS_API_KEY = "LCWVnmPxo77jmM7bhp5NaArPPRQXiW9QfwVhvWJ4BeCd5np6n9jA9zhW";

router.get('/search', async (req, res) => {
  const query = req.query.q;

  try {
    let pixabayImages = [];
    let pexelsImages = [];

    // Try Pixabay first
    try {
      const pixabayRes = await axios.get('https://pixabay.com/api/', {
        params: {
          key: PIXABAY_API_KEY,
          q: query,
          image_type: 'photo',
          per_page: 10
        }
      });

      pixabayImages = pixabayRes.data?.hits?.map(img => ({
        url: img.webformatURL,
        source: 'pixabay',
        tags: img.tags
      })) || [];
    } catch (err) {
      console.warn("Pixabay failed:", err.message);
    }

    // If Pixabay gave 0, try getting 15 from Pexels
    const pexelsCount = pixabayImages.length === 0 ? 15 : 5;

    try {
      const pexelsRes = await axios.get('https://api.pexels.com/v1/search', {
        headers: {
          Authorization: PEXELS_API_KEY
        },
        params: {
          query,
          per_page: pexelsCount
        }
      });

      pexelsImages = pexelsRes.data?.photos?.map(photo => ({
        url: photo.src.large || photo.src.medium || photo.src.original,
        source: 'pexels',
        photographer: photo.photographer
      })) || [];
    } catch (err) {
      console.warn("Pexels failed:", err.message);
    }

    // If Pexels failed and Pixabay gave 0, try to get 15 from Pixabay instead
    if (pexelsImages.length === 0 && pixabayImages.length === 0) {
      try {
        const fallbackPixabayRes = await axios.get('https://pixabay.com/api/', {
          params: {
            key: PIXABAY_API_KEY,
            q: query,
            image_type: 'photo',
            per_page: 15
          }
        });

        pixabayImages = fallbackPixabayRes.data?.hits?.map(img => ({
          url: img.webformatURL,
          source: 'pixabay',
          tags: img.tags
        })) || [];
      } catch (err) {
        console.error("Fallback Pixabay failed:", err.message);
      }
    }

    const combined = [...pixabayImages, ...pexelsImages];
    return res.json(combined);

  } catch (err) {
    console.error('Final image fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch images from both sources.' });
  }
});

module.exports = router;
