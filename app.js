const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const postGenerationRoutes = require('./routes/scheduler');
const dotenv = require('dotenv');
const session = require('express-session');
const linkedinRoutes = require('./routes/linkedinRoutes');

dotenv.config();

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/post-generation', postGenerationRoutes);
app.use('/linkedin', linkedinRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 