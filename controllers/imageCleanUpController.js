const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const PostDraftOrSchedule = require('../models/PostDraftOrSchedule');

const IMAGE_DIR = path.join(__dirname, '../generated_images');

const startImageCleanupCron = () => {
  cron.schedule('0 * * * *', async () => { // run every hour
    console.log('image cleanup');

    try {
      const files = fs.readdirSync(IMAGE_DIR);
      const now = new Date();

      for (const file of files) {
        const filePath = path.join(IMAGE_DIR, file);
        const stats = fs.statSync(filePath);
        const fileCreated = new Date(stats.birthtime);

        const relativePath = `generated_images/${file}`;
        const isReferenced = await PostDraftOrSchedule.exists({ imageUrl: relativePath });

        if (!isReferenced) {
          fs.unlinkSync(filePath);
          console.log(`Deleted unused image: ${file}`);
        }
      }

    } catch (error) {
      console.error('Image cleanup error:', error);
    }
  });

  console.log('Hourly image cleanup scheduled.');
};

module.exports = { startImageCleanupCron };
