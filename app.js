const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const session = require('express-session');
const cors = require('cors');
const passport = require('passport');
const authRoutes = require('./routes/auth');
const postGenerationRoutes = require('./routes/scheduler');
const linkedinRoutes = require('./routes/linkedinRoutes');
const facebookRoutes = require('./routes/facebookRoutes');
const instagramRoutes = require('./routes/instagramRoutes');
const xRoutes = require('./routes/xRoutes');
const draftsRoutes = require('./routes/draftsRoutes');
const userRoutes = require('./routes/users');
const generatedimages = require('./routes/generatedimages');
const vertexImage = require('./routes/vertexImage');
const openaiImage = require('./routes/openai');
const path = require('path');
const openaiCaption = require('./routes/openaiCaption');

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // adjust if needed
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', postGenerationRoutes);
app.use('/api/auth', linkedinRoutes); // includes /linkedin etc.
app.use('/api/auth', facebookRoutes); // includes /linkedin etc.
app.use('/api/auth', instagramRoutes);
app.use('/api/auth', xRoutes);
app.get('/', (req, res) => {
  res.send('API is working!');
});
app.use('/api/drafts', draftsRoutes); // includes /draft etc.
app.use('/api/generatedimages', generatedimages) //  includes /generatedimages etc.
app.use('/generated_images', express.static(path.join(__dirname, 'generated_images')));
app.use('/api/images', vertexImage); // images from google vertex
app.use('/api/image', openaiImage); // images from openai
app.use('/api/openai', openaiCaption);
module.exports = app;