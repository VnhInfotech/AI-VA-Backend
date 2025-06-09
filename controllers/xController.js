const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const XAccount = require('../models/XAccount');
const stateStore = new Map();
const xPostService = require('../Services/xPostService');
const PostDraftOrSchedule = require('../models/PostDraftOrSchedule');
const XPost = require('../models/XPostModel');
const socialQueue = require('../scheduler/socialQueue');

function saveState(oauth_token, state) {
  stateStore.set(oauth_token, state);
}

function consumeState(oauth_token) {
  const state = stateStore.get(oauth_token);
  if (state) {
    stateStore.delete(oauth_token);
  }
  return state;
}

// x oauth
exports.redirectToX = async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: 'Missing token in request' });
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY,
    appSecret: process.env.TWITTER_CONSUMER_SECRET,
  });

  try {
    const { oauth_token, oauth_token_secret, url } = await client.generateAuthLink(
      process.env.X_CALLBACK_URL
    );

    const jwtToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '5m' });

    const statePayload = {
      token: jwtToken,
      oauth_token_secret,
      random: crypto.randomBytes(8).toString('hex'),
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

    saveState(oauth_token, state);

    res.redirect(url);
  } catch (error) {
    console.error('Error generating auth link:', error);
    res.status(500).send('Error initiating Twitter authentication.');
  }
};

// x callback
exports.handleXCallback = async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  if (!oauth_token || !oauth_verifier) {
    return sendPopupResponse(res, false, "Missing authentication details.");
  }

  const savedState = consumeState(oauth_token);
  if (!savedState) {
    return sendPopupResponse(res, false, "State not found or expired.");
  }

  let userId, oauth_token_secret;
  try {
    const decodedState = JSON.parse(Buffer.from(savedState, 'base64').toString());
    const decodedToken = jwt.verify(decodedState.token, process.env.JWT_SECRET);
    userId = decodedToken.id;
    oauth_token_secret = decodedState.oauth_token_secret;
  } catch (err) {
    return sendPopupResponse(res, false, "Invalid or expired token.");
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY,
    appSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: oauth_token,
    accessSecret: oauth_token_secret,
  });

  try {
    const loginResult = await client.login(oauth_verifier);

    const { accessToken, accessSecret, userId: twitterUserId } = loginResult;

    const userClient = new TwitterApi({
      appKey: process.env.TWITTER_CONSUMER_KEY,
      appSecret: process.env.TWITTER_CONSUMER_SECRET,
      accessToken,
      accessSecret,
    });

    const { data: profile } = await userClient.v2.me({ 'user.fields': 'profile_image_url' });

    const name = profile.name;
    const username = profile.username;
    const picture = profile.profile_image_url || null;

    // Save or update in DB
    const existingAccount = await XAccount.findOne({ twitterId: twitterUserId, user: userId });

    if (existingAccount) {
      existingAccount.isEnabled = true;
      existingAccount.accessToken = accessToken;
      existingAccount.accessTokenSecret = accessSecret;
      existingAccount.name = name;
      existingAccount.username = username;
      existingAccount.profilePicture = picture;
      await existingAccount.save();

      return sendPopupResponse(res, true, "X account reconnected!");
    }

    await XAccount.findOneAndUpdate(
      { twitterId: twitterUserId },
      {
        user: userId,
        twitterId: twitterUserId,
        name,
        username,
        profilePicture: picture,
        accessToken,
        accessTokenSecret: accessSecret,
        isEnabled: true,
      },
      { new: true, upsert: true }
    );

    return sendPopupResponse(res, true, "X account successfully connected!");
  } catch (error) {
    console.error('X OAuth error:', error?.response?.data || error.message);
    return sendPopupResponse(res, false, "Something went wrong during authentication.");
  }
};

const sendPopupResponse = (res, success, message) => {
  const color = success ? "#4CAF50" : "#F44336";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>X OAuth</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 80px; }
          h2 { color: ${color}; }
        </style>
      </head>
      <body>
        <h2>${message}</h2>
        <p>This window will close automatically in a few seconds...</p>
        <script>
          window.opener && window.opener.postMessage({ type: "X_ACCOUNT_CONNECTED" }, "*");
          setTimeout(() => window.close(), 1000);
        </script>
      </body>
    </html>
  `;
  res.send(html);
};

exports.getXAccounts = async (req, res) => {
  try {
    const accounts = await XAccount.find({ user: req.user.id, isEnabled: true });
    // const accountsWithPosts = await Promise.all(
    //   accounts.map(async (account) => {
    //     const postCount = await XPost.countDocuments({ xAccount: account._id });
    //     return {
    //       ...account.toObject(),
    //       totalPosts: postCount
    //     };
    //   })
    // );

    res.json({ accounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.disconnectXAccount = async (req, res) => {
  try {
    const accountId = req.params.accountId;
    const updatedAccount = await XAccount.findByIdAndUpdate(
      accountId,
      { isEnabled: false },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({ message: "X account not found" });
    }

    res.status(200).json({ message: "Account disconnected", account: updatedAccount });
  } catch (error) {
    res.status(500).json({ message: "Failed to disconnect account", error });
  }
};

// exports.postToXWithMedia = async (req, res) => {
//   const { xAccountId, caption, imageUrl } = req.body;
//   const userId = req.user.id;
  
//   if (!xAccountId || !caption || !imageUrl) {
//     return res.status(400).json({ success: false, message: 'Missing xAccountId, text, or imageUrl.' });
//   }

//   try {
//     // const account = await XAccount.findOne({ userId: xAccountId });
//     const account = await XAccount.findOne({ user: userId,
//     });
    
//     if (!account || !account.accessToken || !account.accessTokenSecret) {
//       return res.status(403).json({ success: false, message: 'No connected Twitter account.' });
//     }

//     const userClient = new TwitterApi({
//       appKey: process.env.TWITTER_CONSUMER_KEY,
//       appSecret: process.env.TWITTER_CONSUMER_SECRET,
//       accessToken: account.accessToken,
//       accessSecret: account.accessTokenSecret,
//     });

//     const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
//     const mediaBuffer = Buffer.from(imageResponse.data, 'binary');

//     const mediaId = await userClient.v1.uploadMedia(mediaBuffer, { mimeType: 'image/png' });

//     // const tweet = await userClient.v2.tweet('Hello world from API v2!');

//     const tweet = await userClient.v2.tweet({
//       text: caption,
//       media: { media_ids: [mediaId] }
//     });

//     return res.json({ success: true, tweetId: tweet.data.id });
//   } catch (err) {
//     console.error('Error posting tweet with image:', err?.response?.data || err.message);
//     return res.status(500).json({ success: false, message: 'Failed to post tweet with image.' });
//   }
// };

exports.postToXWithMedia = async (req, res) => {
  const { xAccountId, caption, imageUrl } = req.body;
  const userId = req.user.id;

  if (!xAccountId || !caption || !imageUrl) {
    return res.status(400).json({ success: false, message: 'Missing xAccountId, text, or imageUrl.' });
  }

  try {
    const response = await xPostService.postToX({ xAccountId, caption, imageUrl, userId });

    const newPost = new XPost({
      xAccount: xAccountId,
      content: caption,
      mediaUrls: [imageUrl],
      tweetId: response.tweetId,
      postedAt: new Date(),
    });

    await newPost.save();
    res.status(200).json({ success: true, ...response });
  } catch (err) {
    console.error('Error posting tweet with image:', err?.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Failed to post tweet with image.' });
  }
};

exports.scheduleXPost = async (req, res) => {
  const { xAccountId, imageUrl, caption, scheduledTime } = req.body;
  const userId = req.user.id;

  try {
    const account = await XAccount.findOne({
      user: userId
    });

    if (!account) {
      return res.status(404).json({ message: "X account not found" });
    }

    const post = await new PostDraftOrSchedule({
      user: userId,
      platform: 'X',
      content: caption,
      imageUrl,
      scheduledTime,
      isDraft: false,
      isSent: false,
      status: 'pending',
      xAccountId: account._id
    }).save();

    const delay = Math.max(0, new Date(scheduledTime) - new Date());

    const job = await socialQueue.add('social-media-post-queue', { postId: post._id }, {
  delay,
  attempts: 3
});
    console.log(`X Job ${job.id} scheduled with delay: ${delay}ms at ${scheduledTime}`);

    res.status(200).json({ message: "X post scheduled successfully", postId: post._id });
  } catch (error) {
    console.error("X scheduling failed:", error.message || error);
    res.status(500).json({ message: "X scheduling failed" });
  }
};
