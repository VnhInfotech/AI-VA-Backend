const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const socialQueue = new Queue('social-media-post-queue', { connection });

socialQueue.on('failed', ({ jobId, failedReason }) => {
  console.log(`Unified Job ${jobId} failed: ${failedReason}`);
});

socialQueue.on('completed', ({ jobId }) => {
  console.log(`Unified Job ${jobId} completed successfully`);
});

socialQueue.on('waiting', ({ jobId }) => {
  console.log(`Unified Job ${jobId} is waiting to be processed`);
});

socialQueue.on('active', ({ jobId }) => {
  console.log(`Unified Job ${jobId} is now active`);
});

module.exports = socialQueue;
