const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const querystring = require('querystring');
const User = require('../models/User'); // Import the User model
const linkedinPostService = require('../services/linkedinPostService'); // Import the LinkedIn post service
const LinkedInAccount = require('../models/LinkedInAccount');
const LinkedInPost = require('../models/LinkedInPostModel');
const PostDraftOrSchedule = require('../models/PostDraftOrSchedule');
const linkedinQueue = require('../scheduler/linkedinQueue');

// LinkedIn app credentials
const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_CALLBACK_URL; // The URL to redirect to after authentication

// redirect user to LinkedIn for authentication
exports.redirectToLinkedIn = (req, res) => {
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

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email w_member_social',
    state
  })}`;

  res.redirect(authUrl);
};

// handle the callback from LinkedIn
exports.handleLinkedInCallback = async (req, res) => {
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
    return sendPopupResponse(res, false, "Invalid or expired token.");
  }

  try {
    const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const accessToken = tokenRes.data.access_token;
    const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const linkedinId = profileRes.data.sub;
    const name = profileRes.data.name;
    const email = profileRes.data.email;
    const picture = profileRes.data.picture || null;

    const existingAccount = await LinkedInAccount.findOne({ linkedinId, user: { $exists: true } });

    if (existingAccount) {
      if (!existingAccount.isEnabled) {
        existingAccount.isEnabled = true;
        existingAccount.accessToken = accessToken;
        existingAccount.tokenExpiry = tokenExpiry; // store expiry
        existingAccount.name = name;
        existingAccount.email = email;
        existingAccount.profilePicture = picture;

        await existingAccount.save();

        return sendPopupResponse(res, true, "LinkedIn account reconnected!");
      } else {
        return sendPopupResponse(res, true, "LinkedIn account already connected.");
      }
    }

    await LinkedInAccount.findOneAndUpdate(
      { linkedinId },
      {
        user: userId,
        linkedinId,
        name,
        email,
        profilePicture: picture,
        accessToken,
        tokenExpiry,
        isEnabled: true,
      },
      { new: true, upsert: true }
    );

    return sendPopupResponse(res, true, "LinkedIn account successfully connected!");
  } catch (error) {
    console.error('LinkedIn OAuth error:', error?.response?.data || error.message);
    return sendPopupResponse(res, false, "Something went wrong during authentication.");
  }
};

const sendPopupResponse = (res, success, message) => {
  const color = success ? "#4CAF50" : "#F44336";
  const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>LinkedIn OAuth</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              margin-top: 80px;
            }
            h2 {
              color: ${color};
            }
          </style>
        </head>
        <body>
          <h2>${message}</h2>
          <p>This window will close automatically in a few seconds...</p>
          <script>
    window.opener && window.opener.postMessage({ type: "LINKEDIN_ACCOUNT_CONNECTED" }, "*");
    setTimeout(() => window.close(), 1000);
  </script>
  
        </body>
      </html>
    `;
  res.send(html);
};

// post to LinkedIn
exports.postToLinkedIn = async (req, res) => {
  console.log("Received request to post on LinkedIn");  // Debug log
  const { content, imageUrl, linkedinAccountId } = req.body;
  const userId = req.user.id;

  try {
    const account = await LinkedInAccount.findOne({
      _id: linkedinAccountId,
      user: userId,
    });

    if (!account || !account.accessToken) {
      return res.status(404).json({ message: 'LinkedIn account not found or unauthorized' });
    }

    const postResponse = await linkedinPostService.postToLinkedIn(
      account.accessToken,
      account.linkedinId,
      content,
      imageUrl
    );

    const newPost = new LinkedInPost({
      linkedinAccount: account._id,
      originalContent: imageUrl,
      generatedContent: content,
      postedAt: new Date(),
    });

    await newPost.save();

    res.status(200).json({ message: 'Post created successfully', postResponse });
  } catch (error) {
    console.error('Error posting to LinkedIn:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error posting to LinkedIn' });
  }
};

exports.getLinkedInAccounts = async (req, res) => {
  try {
    const accounts = await LinkedInAccount.find({ user: req.user.id, isEnabled: true });
    const accountsWithPosts = await Promise.all(
      accounts.map(async (account) => {
        const postCount = await LinkedInPost.countDocuments({ linkedinAccount: account._id });
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

exports.toggleLinkedInAccount = async (req, res) => {
  const { accountId } = req.params;

  try {
    const account = await LinkedInAccount.findOne({ _id: accountId, user: req.user.id });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    account.isEnabled = !account.isEnabled;
    await account.save();

    res.json({ message: 'Account status updated', isEnabled: account.isEnabled });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle account status' });
  }
};

// disconnect linkedin account : set isEnabled : false
exports.disconnectLinkedInAccount = async (req, res) => {
  try {
    const accountId = req.params.accountId;

    const updatedAccount = await LinkedInAccount.findByIdAndUpdate(
      accountId,
      { isEnabled: false },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({ message: "LinkedIn account not found" });
    }

    res.status(200).json({ message: "Account disconnected", account: updatedAccount });
  } catch (error) {
    res.status(500).json({ message: "Failed to disconnect account", error });
  }
};

// schedule post
exports.scheduleLinkedInPost = async (req, res) => {
  const { content, imageUrl, scheduledTime, linkedinAccountId } = req.body;
  const userId = req.user.id;
  try {
    const account = await LinkedInAccount.findOne({
      _id: linkedinAccountId,
      user: userId
    });

    const post = await new PostDraftOrSchedule({
      user: userId,
      platform: 'LinkedIn',
      content,
      imageUrl,
      scheduledTime,
      isDraft: false,
      isSent: false,
      status: 'pending',
      linkedinAccountId: account._id
    }).save();

    const delay = Math.max(0, new Date(scheduledTime) - new Date());
    const job = await linkedinQueue.add('linkedin-post-queue', { postId: post._id }, {
      delay,
      attempts: 3
    });

    console.log(`Job ${job.id} scheduled with delay: ${delay}ms at ${scheduledTime}`);
    res.status(200).json({ message: "Post scheduled successfully", postId: post._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Scheduling failed" });
  }
};