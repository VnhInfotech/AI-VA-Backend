require('dotenv').config({ path: '../.env' });
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Instagram Worker connected to MongoDB");
}).catch(err => {
  console.error("MongoDB connection error in Instagram Worker:", err.message);
});

const publishToInstagram = require('../Services/instagramPostService');
const InstagramAccount = require('../models/InstagramAccount');
const InstagramPost = require('../models/InstagramPostModel');
const PostDraftOrSchedule = require('../models/PostDraftOrSchedule');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const worker = new Worker('instagram-post-queue', async job => {
  try {
    const postId = job.data.postId;
    const post = await PostDraftOrSchedule.findById(postId);

    if (!post || post.isSent || post.status === 'posted') {
      console.log('Post already sent or not found.');
      return;
    }

    const account = await InstagramAccount.findById(post.instagramAccountId);
    if (!account || !account.accessToken) {
      post.status = 'failed';
      await post.save();
      return;
    }

    try {
      const result = await publishToInstagram(account.instagramId, post.imageUrl, post.content);
      const igPostId = result?.postId?.id || null;

      await new InstagramPost({
        instagramAccount: account._id,
        imageUrl: post.imageUrl,
        caption: post.content,
        instagramPostId: igPostId,
        postedAt: new Date()
      }).save();

      // Update pwost draft/schedule
      post.status = 'posted';
      post.isSent = true;
      if (igPostId) post.instagramPostId = igPostId;
      await post.save();

      console.log(`Successfully posted Instagram content for post ID: ${post._id}`);
    } catch (err) {
      console.error('Posting to Instagram failed:', err.message || err);
      post.status = 'failed';
      await post.save();
    }

  } catch (err) {
    console.error('Worker job failed with error:', err.message || err);
  }
}, { connection });

console.log("Worker running and ready to process Instagram scheduled posts.");

module.exports = worker;
