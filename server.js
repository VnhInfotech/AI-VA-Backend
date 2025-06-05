const app = require('./app');
const PORT = process.env.PORT || 5000;
const { startImageCleanupCron } = require('./controllers/imageCleanUpController');

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  startImageCleanupCron();
});