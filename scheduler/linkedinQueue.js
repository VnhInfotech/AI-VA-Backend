const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const linkedinQueue = new Queue('linkedin-post-queue', { connection });
linkedinQueue.on('failed', ({ jobId, failedReason }) => {
  console.log(`Job ${jobId} failed: ${failedReason}`);
});

linkedinQueue.on('completed', ({ jobId }) => {
  console.log(`job ${jobId} completed successfully`);
});

linkedinQueue.on('waiting', ({ jobId }) => {
  console.log(`job ${jobId} is waiting to be processed`);
});

linkedinQueue.on('active', ({ jobId }) => {
  console.log(`job ${jobId} is now active`);
});

module.exports = linkedinQueue;
