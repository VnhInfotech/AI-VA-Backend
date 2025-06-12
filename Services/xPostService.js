const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const XAccount = require('../models/XAccount');

const postToX = async ({ caption, imageUrl, account }) => {
  if (!account || !caption || !imageUrl) {
    throw new Error('Missing required fields: userId, caption, imageUrl');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY,
    appSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: account.accessToken,
    accessSecret: account.accessTokenSecret,
  });

  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const mediaBuffer = Buffer.from(imageResponse.data, 'binary');
  const mediaId = await client.v1.uploadMedia(mediaBuffer, { mimeType: 'image/png' });

  const tweet = await client.v2.tweet({
    text: caption,
    media: { media_ids: [mediaId] },
  });

  return {
    success: true,
    tweetId: tweet.data.id,
    message: 'Tweet posted successfully!',
  };
};

module.exports = {
  postToX,
};
