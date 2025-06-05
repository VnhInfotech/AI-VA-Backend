const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const querystring = require('querystring');
const InstagramAccount = require('../models/InstagramAccount');
const User = require('../models/User');
const mongoose = require('mongoose');
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_CALLBACK_URL;

// insta OAuth flow
exports.redirectToInstagram = (req, res) => {
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
  // generate this url from instagram meta app
  const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=558606803988576&redirect_uri=https://7ea8-2402-a00-401-43ed-cd21-cfe4-a0da-60f5.ngrok-free.app/api/auth/instagram/callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights&state=${encodeURIComponent(state)}`;
  res.redirect(authUrl);
};

// instagram OAuthcallback
exports.handleInstagramCallback = async (req, res) => {
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
    const tokenRes = await axios.post(
  'https://api.instagram.com/oauth/access_token',
  querystring.stringify({
    client_id: process.env.INSTAGRAM_APP_ID,
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    code
  }),
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }
);

    const shortLivedToken = tokenRes.data.access_token;
    const userIdInstagram = tokenRes.data.user_id;

    // exchange for long-lived token
const longTokenRes = await axios.get('https://graph.instagram.com/access_token', {
  params: {
    grant_type: 'ig_exchange_token',
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    access_token: shortLivedToken
  }
});

    const longLivedToken = longTokenRes.data.access_token;
    const expiresIn = longTokenRes.data.expires_in;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    const profilePicRes = await axios.get('https://graph.instagram.com/v23.0/me', {
  params: {
    fields: 'id,user_id,username,account_type,media_count,profile_picture_url',
    access_token: longLivedToken
  }
});

const profilePicUrl = profilePicRes.data.profile_picture_url;
    const instagramId = profilePicRes.data.id;
    const username = profilePicRes.data.username;
    const accountType = profilePicRes.data.account_type;

    // create or update insta acc
    const existingAccount = await InstagramAccount.findOne({ instagramId, user: { $exists: true } });

    if (existingAccount) {
      if (!existingAccount.isEnabled) {
        existingAccount.isEnabled = true;
        existingAccount.accessToken = longLivedToken;
        existingAccount.tokenExpiry = tokenExpiry;
        existingAccount.username = username;
        existingAccount.accountType = accountType;

        await existingAccount.save();
        return sendPopupResponse(res, true, "Instagram account reconnected!");
      } else {
        return sendPopupResponse(res, true, "Instagram account already connected.");
      }
    }

    await InstagramAccount.findOneAndUpdate(
      { instagramId },
      {
        user: userId,
        instagramId,
        username,
        accountType,
        accessToken: longLivedToken,
        tokenExpiry,
        isEnabled: true,
        profilePicUrl
      },
      { new: true, upsert: true }
    );

    return sendPopupResponse(res, true, "Instagram account connected successfully!");
  } catch (error) {
    console.error('Instagram OAuth error:', error?.response?.data || error.message);
    return sendPopupResponse(res, false, "Authentication failed.");
  }
};

const sendPopupResponse = (res, success, message) => {
  const color = success ? "#4CAF50" : "#F44336";
  const html = `
    <!DOCTYPE html><html><head><title>Instagram OAuth</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 80px; }
        h2 { color: ${color}; }
      </style>
    </head><body>
      <h2>${message}</h2>
      <p>This window will close shortly...</p>
      <script>
        window.opener && window.opener.postMessage({ type: "INSTAGRAM_ACCOUNT_CONNECTED" }, "*");
        setTimeout(() => window.close(), 1500);
      </script>
    </body></html>`;
  res.send(html);
};

exports.getInstagramAccounts = async (req, res) => {
  try {
    const accounts = await InstagramAccount.find({ user: req.user.id, isEnabled: true });
    const accountsWithPosts = await Promise.all(
      accounts.map(async (account) => {
        const postCount = await InstagramAccount.countDocuments({ InstagramAccount: account._id });
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

exports.publishInstagramPost = async (req, res) => {
  try {
    const { igAccountId, imageUrl, caption } = req.body;

    if (!igAccountId || !imageUrl || !caption) {
      return res.status(400).json({ error: 'Missing required fields: igAccountId, imageUrl, caption.' });
    }

const igAccount = await InstagramAccount.findOne({
  instagramId: igAccountId,
  user: req.user.id
});
    if (!igAccount) {
      return res.status(404).json({ error: 'Instagram account not found.' });
    }

    const token = "IGAAH8DMge8GBBZAFBIdnJucHlSZAmxFd3dTTEdsN0RweUpEUHc1dWtvOWZAGdkJDcDNIRHlSbEF3SGl3ZAHliXzhFNmZADTmpmVGNzUGtVWDlQSDI1YlROTllORllxM3hCTk5NdHF3b1FyMHVHRkFuSTBTcElvMEhENjZArQmF6T0VRYwZDZD";
    const igUserId = igAccount.instagramId;

const createMediaResponse = await axios.post(
  `https://graph.facebook.com/v17.0/${igUserId}/media?access_token=${token}`,
  {
    image_url: imageUrl,
    caption: caption
  }
);

    const creationId = createMediaResponse.data.id;
    if (!creationId) {
      throw new Error('Failed to create media container.');
    }
    
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v17.0/${igUserId}/media_publish`,
      {
        creation_id: creationId,
        access_token: token
      }
    );

    res.status(200).json({
      success: true,
      message: 'Post published successfully!',
      postId: publishResponse.data.id
    });
  } catch (error) {
    console.error('Instagram publish error:', error.response?.data || error.message);

    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: `Failed to publish to Instagram: ${errorMessage}` });
  }
};

