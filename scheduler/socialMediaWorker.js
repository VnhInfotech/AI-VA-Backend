require('dotenv').config({ path: '../.env' });
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');
const PostDraftOrSchedule = require('../models/PostDraftOrSchedule');
const linkedinPostService = require('../services/linkedinPostService');
const instagramPostService = require('../Services/instagramPostService');
const xPostService = require('../Services/xPostService');
const LinkedInAccount = require('../models/LinkedInAccount');
const InstagramAccount = require('../models/InstagramAccount');
const XAccount = require('../models/XAccount');
const LinkedInPost = require('../models/LinkedInPostModel');
const InstagramPost = require('../models/InstagramPostModel');
const XPost = require('../models/XPostModel');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Social Media Worker connected to MongoDB");
}).catch(err => {
  console.error("MongoDB connection error:", err.message);
});

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const socialMediaWorker = new Worker('social-media-post-queue', async job => {
  const { postId } = job.data;

  const post = await PostDraftOrSchedule.findById(postId);
  if (!post || post.isSent || post.status === 'posted') {
    console.log(`Post ${postId} already sent or not found.`);
    return;
  }

  try {
    switch (post.platform) {
      case 'LinkedIn': {
        const account = await LinkedInAccount.findById(post.linkedinAccountId);
        if (!account || !account.accessToken) throw new Error("LinkedIn account or token missing");

        await linkedinPostService.postToLinkedIn(account.accessToken, account.linkedinId, post.content, post.imageUrl);

        await new LinkedInPost({
          linkedinAccount: account._id,
          originalContent: post.imageUrl,
          generatedContent: post.content,
          postedAt: new Date(),
        }).save();
        break;
      }

      case 'Instagram': {
        const account = await InstagramAccount.findById(post.instagramAccountId);
        if (!account || !account.accessToken) throw new Error("Instagram account or token missing");

        const result = await instagramPostService.publishToInstagram(account.instagramId, post.imageUrl, post.content, post.user);
        const igPostId = result?.postId?.id || null;

        await new InstagramPost({
          instagramAccount: account._id,
          imageUrl: post.imageUrl,
          caption: post.content,
          instagramPostId: igPostId,
          postedAt: new Date()
        }).save();

        if (igPostId) post.instagramPostId = igPostId;
        break;
      }

      case 'X': {
        const account = await XAccount.findById(post.xAccountId);
        if (!account || !account.accessToken || !account.accessTokenSecret) throw new Error("X account or token missing");

        const response = await xPostService.postToX({
          xAccountId: post.xAccountId,
          userId: post.user,
          caption: post.content,
          imageUrl: post.imageUrl
        });

        await new XPost({
          xAccount: account._id,
          content: post.content,
          mediaUrls: [post.imageUrl],
          tweetId: response.tweetId,
          postedAt: new Date(),
        }).save();

        break;
      }

      default:
        throw new Error(`Unsupported platform: ${post.platform}`);
    }

    post.status = 'posted';
    post.isSent = true;
    await post.save();

    console.log(`Successfully posted ${post.platform} content for post ID: ${post._id}`);
  } catch (err) {
    console.error(`${post.platform} post failed:`, err.message || err);
    post.status = 'failed';
    await post.save();
  }

}, { connection });

console.log("Social Media Worker is running.");

module.exports = socialMediaWorker;
