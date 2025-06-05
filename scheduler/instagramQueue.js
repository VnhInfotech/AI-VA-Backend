const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const instagramQueue = new Queue('instagram-post-queue', { connection });

instagramQueue.on('failed', ({ jobId, failedReason }) => {
  console.log(`Instagram Job ${jobId} failed: ${failedReason}`);
});

instagramQueue.on('completed', ({ jobId }) => {
  console.log(`Instagram Job ${jobId} completed successfully`);
});

instagramQueue.on('waiting', ({ jobId }) => {
  console.log(`Instagram Job ${jobId} is waiting to be processed`);
});

instagramQueue.on('active', ({ jobId }) => {
  console.log(`Instagram Job ${jobId} is now active`);
});

module.exports = instagramQueue;
