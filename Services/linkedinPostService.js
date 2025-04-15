const axios = require('axios');

// Function to post content and image to LinkedIn
const postToLinkedIn = async (accessToken, linkedinId, content, imageUrl) => {
  try {
    // Step 1: Register image upload
    const registerRes = await axios.post(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        registerUploadRequest: {
          owner: `urn:li:person:${linkedinId}`,
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          serviceRelationships: [
            {
              identifier: 'urn:li:userGeneratedContent',
              relationshipType: 'OWNER',
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const uploadUrl = registerRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const assetUrn = registerRes.data.value.asset;

    // Step 2: Download image as buffer
    const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' }).then(res => res.data);

    // Step 3: Upload the image
    await axios.put(uploadUrl, imageBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
        'Content-Length': imageBuffer.length,
      },
    });

    // Step 4: Create LinkedIn post
    const postRes = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      {
        author: `urn:li:person:${linkedinId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: 'IMAGE',
            media: [
              {
                status: 'READY',
                media: assetUrn,
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return postRes.data;
  } catch (error) {
    console.error('Error in LinkedIn image post:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { postToLinkedIn };
