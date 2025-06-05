const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const querystring = require('querystring');
const User = require('../models/User');
const FacebookAccount = require('../models/FacebookAccount');
const FacebookPost = require('../models/FacebookPostModel');
const PostDraftOrSchedule = require('../models/PostDraftOrSchedule');

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_CALLBACK_URL;

// fb OAuth flow
exports.redirectToFacebook = (req, res) => {
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

  const jwtToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const statePayload = {
    token: jwtToken,
    random: crypto.randomBytes(8).toString('hex'),
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

  const authUrl = `https://www.facebook.com/v16.0/dialog/oauth?${querystring.stringify({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: FACEBOOK_REDIRECT_URI,
    // scope: 'public_profile,email',
    config_id: '1378593973195017',
    state: state
  })}`;
  res.redirect(authUrl);
};

// handle redirect flow
exports.handleFacebookCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return sendPopupResponse(res, false, "Missing authentication details.");
  }

  let userId;
  try {
    const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
    const decodedToken = jwt.verify(decodedState.token, process.env.JWT_SECRET);
    userId = decodedToken.id;
  } catch (err) {
    return sendPopupResponse(res, false, "Invalid or expired state parameter.");
  }

  try {
    const tokenRes = await axios.get('https://graph.facebook.com/v16.0/oauth/access_token', {
  params: {
    client_id: FACEBOOK_APP_ID,
    redirect_uri: FACEBOOK_REDIRECT_URI,
    client_secret: FACEBOOK_APP_SECRET,
    code,
  }
});
    let accessToken = tokenRes.data.access_token;

    try {
      const longTokenRes = await axios.get('https://graph.facebook.com/v16.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          fb_exchange_token: accessToken
        }
      });

      accessToken = longTokenRes.data.access_token;
      var tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // ~60 days
    } catch (longTokenErr) {
      console.warn("Long-lived token exchange failed:", longTokenErr.response?.data || longTokenErr.message);
      var tokenExpiry = new Date(Date.now() + tokenRes.data.expires_in * 1000);
    }

    // fetch user profile
    const profileRes = await axios.get('https://graph.facebook.com/me', {
      params: {
        fields: 'id,name,email,picture',
        access_token: accessToken,
      }
    });
    const facebookId = profileRes.data.id;
    const name = profileRes.data.name;
    const email = profileRes.data.email;
    const picture = profileRes.data.picture?.data?.url || null;

    const existingAccount = await FacebookAccount.findOne({ facebookId, user: { $exists: true } });

    if (existingAccount) {
      if (!existingAccount.isEnabled) {
        existingAccount.isEnabled = true;
        existingAccount.accessToken = accessToken;
        existingAccount.tokenExpiry = tokenExpiry; 
        existingAccount.name = name;
        existingAccount.email = email;
        existingAccount.profilePicture = picture;

        await existingAccount.save();

        return sendPopupResponse(res, true, "Facebook account reconnected!");
      } else {
        return sendPopupResponse(res, true, "Facebook account already connected.");
      }
    }

    await FacebookAccount.findOneAndUpdate(
      { facebookId },
      {
        user: userId,
        facebookId,
        name,
        email,
        profilePicture: picture,
        accessToken,
        tokenExpiry,
        isEnabled: true,
      },
      { new: true, upsert: true }
    );

    return sendPopupResponse(res, true, "Facebook account connected successfully!");
  } catch (error) {
    console.error('Facebook OAuth error:', error?.response?.data || error.message);
    return sendPopupResponse(res, false, "Authentication failed.");
  }
};

const sendPopupResponse = (res, success, message) => {
  const color = success ? "#4CAF50" : "#F44336";
  const html = `
    <!DOCTYPE html><html><head><title>Facebook OAuth</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 80px; }
        h2 { color: ${color}; }
      </style>
    </head><body>
      <h2>${message}</h2>
      <p>This window will close shortly...</p>
      <script>
        // Notify the main window and close popup
        window.opener && window.opener.postMessage({ type: "FACEBOOK_ACCOUNT_CONNECTED" }, "*");
        setTimeout(() => window.close(), 1500);
      </script>
    </body></html>`;
  res.send(html);
};

// get connected facebook accounts from database with total posts to facebook
exports.getFacebookAccounts = async (req, res) => {
  try {
    const accounts = await FacebookAccount.find({ user: req.user.id, isEnabled: true });
    const accountsWithPosts = await Promise.all(
      accounts.map(async (account) => {
        const postCount = await FacebookAccount.countDocuments({ FacebookAccount: account._id });
        return {
          ...account.toObject(),
          totalPosts: postCount,
        };
      })
    );

    res.json({ accounts: accountsWithPosts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// disconnect facebook account : set isEnabled : false
exports.disconnectFacebookAccount = async (req, res) => {
  try {
    const accountId = req.params.accountId;

    const updatedAccount = await FacebookAccount.findByIdAndUpdate(
      accountId,
      { isEnabled: false },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({ message: "Facebook account not found" });
    }

    res.status(200).json({ message: "Account disconnected", account: updatedAccount });
  } catch (error) {
    res.status(500).json({ message: "Failed to disconnect account", error });
  }
};

// post to fb
exports.postToFacebook = async (req, res) => {
  const { accountId, imageUrl, caption, postTo } = req.body;

  if (!accountId || !imageUrl || !caption || !postTo) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const account = await FacebookAccount.findOne({ _id: accountId, user: req.user.id, isEnabled: true });
  if (!account) {
    return res.status(404).json({ message: "Facebook account not found" });
  }

  if (postTo === 'feed') {
    // Generate feed dialog URL
    const feedDialogUrl = `https://www.facebook.com/dialog/feed?${querystring.stringify({
      app_id: process.env.FACEBOOK_APP_ID,
      link: imageUrl,
      picture: imageUrl,
      name: 'Check this out!',
      caption: 'Posted via AI Scheduler',
      description: caption,
// redirect_uri: `http://localhost:3000/facebook-feed-success?accountId=${account._id}&imageUrl=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}`
redirect_uri: 'https://www.facebook.com/'
    })}`;
    return res.status(200).json({ feedDialogUrl });
  }

  if (postTo === 'page') {
    const pagesResponse = await axios.get('https://graph.facebook.com/v16.0/me/accounts', {
      params: { access_token: account.accessToken }
    });

    const pages = pagesResponse.data.data;
    if (!pages.length) {
      return res.status(400).json({ message: "No Facebook pages found" });
    }

    const { selectedPageId } = req.body;
    const selectedPage = pages.find(p => p.id === selectedPageId);

    if (!selectedPage) {
      return res.status(404).json({ message: "Selected page not found" });
    }

    const postResponse = await axios.post(
      `https://graph.facebook.com/v16.0/${selectedPage.id}/photos`,
      querystring.stringify({
        url: imageUrl,
        caption,
        access_token: selectedPage.access_token,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Save in DB
    const newPost = new FacebookPost({
      facebookAccount: account._id,
      postedTo: 'page',
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      imageUrl,
      caption,
      facebookPostId: postResponse.data.id,
    });

    await newPost.save();

    return res.status(200).json({ message: "Posted to page successfully", postId: postResponse.data.id });
  }

  return res.status(400).json({ message: "Invalid postTo option" });
};

exports.logFeedPost = async (req, res) => {
  const { accountId, imageUrl, caption } = req.body;
  const userId = req.user.id;

  const account = await FacebookAccount.findOne({ _id: accountId, user: userId, isEnabled: true });
  if (!account) return res.status(404).json({ message: "Facebook account not found" });

  const post = new FacebookPost({
    facebookAccount: account._id,
    postedTo: "feed",
    imageUrl,
    caption,
    facebookPostId: null,
  });

  await post.save();
  res.status(200).json({ message: "Post logged" });
};

exports.getUserPages = async (req, res) => {
    try {
  const account = await FacebookAccount.findOne({
      _id: req.params.accountId,
      // user: req.user.id,
      isEnabled: true,
    });
    
    if (!account) {
      return res.status(404).json({ message: "Facebook account not found" });
    }

    const response = await axios.get('https://graph.facebook.com/v16.0/me/accounts', {
      params: {
        access_token: account.accessToken,
      },
    });

    const pages = response.data.data.map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
    }));

    res.status(200).json({ pages });
  } catch (err) {
    console.error('Failed to fetch pages:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch pages' });
  }
}

// schedule post to fb page
exports.scheduleFacebookPagePost = async (req, res) => {
  const { imageUrl, caption, pageId, scheduledTime } = req.body;
  const user = req.user;

  try {
        const fbAccount = await FacebookAccount.findOne({ userId: user._id });

    if (!fbAccount || !fbAccount.accessToken) {
      return res.status(400).json({ message: "Facebook access token not found for user." });
    }

    const userAccessToken = fbAccount.accessToken;

    const accountsRes = await axios.get("https://graph.facebook.com/v18.0/me/accounts", {
      params: {
        access_token: userAccessToken,
      },
    });

    const pages = accountsRes.data.data;
    const page = pages.find(p => p.id === pageId);

    if (!page) {
      return res.status(400).json({ message: "User does not manage this Facebook Page." });
    }

    const pageAccessToken = page.access_token;
    const publishTimeUnix = Math.floor(new Date(scheduledTime).getTime() / 1000);

    const postRes = await axios.post(
      `https://graph.facebook.com/v18.0/${pageId}/photos`,
      null,
      {
        params: {
          url: imageUrl,
          caption,
          published: false,
          scheduled_publish_time: publishTimeUnix,
          access_token: pageAccessToken,
        },
      }
    );

    const fbPostId = postRes.data.id;

    await PostDraftOrSchedule.create({
      user: user._id,
      platform: "Facebook",
      imageUrl,
      content: caption,
      scheduledTime: new Date(scheduledTime),
      isDraft: false,
      isSent: false,
      status: "pending",
      facebookPageId: pageId,
      facebookPostId: fbPostId,
    });

    res.json({ message: "Scheduled Facebook Page post successfully", id: fbPostId });
  } catch (err) {
    console.error("Facebook schedule error:", err?.response?.data || err.message);
    res.status(500).json({ message: "Failed to schedule Facebook post" });
  }
};

// webhook verification call
exports.getWebhookCall = (req, res) => {
  const VERIFY_TOKEN = "my_secret_verify_token_123";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified by Facebook.");
      res.status(200).send(challenge);
    } else {
      console.log("Token mismatch");
      res.sendStatus(403);
    }
  } else {
    console.log("Missing parameters");
    res.sendStatus(400);
  }
};

// handling webhook event
exports.handleWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'page') {
      for (const entry of body.entry) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field === 'feed' && change.value && change.value.item === 'photo') {
            const fbPostId = change.value.post_id || change.value.id;
            const pageId = entry.id;

            if (fbPostId) {
              await PostDraftOrSchedule.findOneAndUpdate(
                { facebookPostId: fbPostId, facebookPageId: pageId },
                { status: 'posted', isSent: true }
              );
              console.log(`Updated post status for Facebook Post ID: ${fbPostId}`);
            }
          }
        }
      }

      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    res.sendStatus(500);
  }
};
