const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const XAccount = require('../models/XAccount');
const stateStore = new Map();

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
      existingAccount.accessSecret = accessSecret;
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
        accessSecret,
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

exports.postXImageTweet = async (req, res) => {
  const { accountId, caption, imageUrl } = req.body;

  try {
    const account = await XAccount.findOne({ twitterId: accountId });
    if (!account || !account.isEnabled) {
      return res.status(404).json({ message: 'X account not found or disabled' });
    }

    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_CONSUMER_KEY,
      appSecret: process.env.TWITTER_CONSUMER_SECRET,
      accessToken: account.accessToken,
      accessSecret: account.accessSecret
    });

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const mediaData = Buffer.from(response.data, 'binary');

    const mediaId = await twitterClient.v1.uploadMedia(mediaData, { mimeType: 'image/jpeg' });

    const tweet = await twitterClient.v1.tweet(caption, { media_ids: [mediaId] });

    res.status(200).json({ success: true, tweetId: tweet.id_str });
  } catch (error) {
    console.error('Error posting to X:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to post to X', error: error.message });
  }
};
