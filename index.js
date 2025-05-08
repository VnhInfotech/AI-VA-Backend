require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const session = require('express-session');
const passport = require('passport');
require('./config/passport');
const schedulerRoutes = require('./routes/scheduler'); // Import the scheduler routes
const linkedinRoutes = require('./routes/linkedinRoutes'); // Import the linkedin routes
const draftsRoutes = require('./routes/draftsRoutes'); // Import the draft routes
const userRoutes = require('./ routes/users'); // Import the user routes
const generatedImagesRoutes = require('./routes/generatedimages');
const vertexImage = require('./routes/vertexImage'); // Import the vertex ai routes
const openaiImage = require('./routes/openai');

const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // Adjust this if your frontend runs on a different port
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scheduler', schedulerRoutes); // Use the scheduler routes
app.use('/api/linkedin', linkedinRoutes); // Use the linkedin routes
app.use('/api/drafts', draftsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/generatedimages', generatedImagesRoutes);
app.use('/api/images', vertexImage);
app.use('/api/image', openaiImage);

// Test DB connection
app.get('/test-db', (req, res) => {
    if (mongoose.connection.readyState === 1) {
        res.json({ status: 'Connected to MongoDB!' });
    } else {
        res.json({ 
            status: 'Not connected to MongoDB!',
            readyState: mongoose.connection.readyState
        });
    }
});

const PORT = process.env.PORT || 5000;

// Start server only after DB connection
const startServer = async () => {
    try {
        await connectDB(); // Wait for DB connection
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
};

startServer();

// Handle process termination
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
}); 