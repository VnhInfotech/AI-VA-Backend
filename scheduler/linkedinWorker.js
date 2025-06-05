require('dotenv').config({ path: '../.env' });
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Worker connected to MongoDB");
}).catch(err => {
  console.error("MongoDB connection error in Worker:", err.message);
});

const linkedinPostService = require('../services/linkedinPostService');
const LinkedInAccount = require('../models/LinkedInAccount');
const PostDraftOrSchedule = require('../models/PostDraftOrSchedule');
const LinkedInPost = require('../models/LinkedInPostModel');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const worker = new Worker('linkedin-post-queue', async job => {
    try {
  const postId = job.data.postId;
  const post = await PostDraftOrSchedule.findById(postId);

  if (!post || post.isSent || post.status === 'posted') {
    console.log('Post already sent or not found.');
    return;
  }

  const account = await LinkedInAccount.findById(post.linkedinAccountId);
  if (!account || !account.accessToken) {
    post.status = 'failed';
    await post.save();
    return;
  }

  try {
    await linkedinPostService.postToLinkedIn(
      account.accessToken,
      account.linkedinId,
      post.content,
      post.imageUrl
    );

    post.status = 'posted';
    post.isSent = true;
    await post.save();

    await new LinkedInPost({
      linkedinAccount: account._id,
      originalContent: post.imageUrl,
      generatedContent: post.content,
      postedAt: new Date(),
    }).save();

    console.log(`Successfully posted LinkedIn content for post ID: ${post._id}`);
  } catch (err) {
    console.error('Posting failed:', err.message || err);
    post.status = 'failed';
    await post.save();
  }
  } catch (err) {
    console.error('Worker job failed with error:', err.message || err);
  }
}, { connection });

console.log("Worker running and ready to process LinkedIn scheduled posts.");

module.exports = worker;