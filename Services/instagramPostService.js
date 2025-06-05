const axios = require('axios');
const InstagramAccount = require('../models/InstagramAccount');

const publishToInstagram = async (igAccountId, imageUrl, caption, userId = null) => {
  if (!igAccountId || !imageUrl || !caption) {
    throw new Error('Missing required fields: igAccountId, imageUrl, caption.');
  }

  const query = userId
    ? { instagramId: igAccountId, user: userId }
    : { instagramId: igAccountId };

  const igAccount = await InstagramAccount.findOne(query);
  if (!igAccount) throw new Error('Instagram account not found.');

  const accessToken = igAccount.accessToken;
  const igUserId = igAccount.instagramId;

  const containerResp = await axios.post(`https://graph.instagram.com/${igUserId}/media`, {
    image_url: imageUrl,
    caption: caption,
    access_token: accessToken
  });

  const creationId = containerResp.data.id;
  if (!creationId) throw new Error('Failed to create media container.');

  const publishResp = await axios.post(`https://graph.instagram.com/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken
  });

  return {
    success: true,
    postId: publishResp.data.id,
    message: 'Post published successfully!'
  };
};

module.exports = publishToInstagram;
