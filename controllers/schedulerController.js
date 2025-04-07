const ScheduledTask = require('../models/ScheduledTask');
const GeneratedPost = require('../models/LinkedInPostModel'); // Import the model
const cron = require('node-cron');
const axios = require('axios');
// const generatePostService = require('../services/GeneratePostService.js');

const taskJobs = {}; // Stores running cron jobs

// Schedule a new task and generate the post content
exports.scheduleTask = async (req, res) => {
    const { content, scheduledTime } = req.body;

    try {
        // Generate LinkedIn post content immediately and save it
        // const generatedContent = await generatePostService.generateLinkedInPost(content);

        // const newGeneratedPost = new GeneratedPost({
        //     originalContent: content,
        //     generatedContent: generatedContent
        // });

        // await newGeneratedPost.save();

        // Create and save the scheduled task
        const task = new ScheduledTask({
            content,
            scheduledTime: new Date(scheduledTime),
            isSent: false
            // generatedPostId: newGeneratedPost._id // Store reference to the generated post
        });

        await task.save();
        scheduleTaskJob(task);

        res.status(201).json({ message: 'Task scheduled successfully', task });
    } catch (error) {
        console.error('Error scheduling task:', error);
        res.status(500).json({ message: 'Error scheduling task' });
    }
};

// Function to schedule the task using node-cron
const scheduleTaskJob = (task) => {
    const scheduledDate = new Date(task.scheduledTime);

    const istMinutes = scheduledDate.getMinutes();
    const istHours = scheduledDate.getHours();
    const istDay = scheduledDate.getDate();
    const istMonth = scheduledDate.getMonth() + 1;

    const cronExpression = `${istMinutes} ${istHours} ${istDay} ${istMonth} *`;

    console.log(`Scheduling task at ${scheduledDate} with cron: ${cronExpression}`);

    if (taskJobs[task._id]) {
        taskJobs[task._id].stop();
    }

    const job = cron.schedule(cronExpression, async () => {
        try {
            await executeScheduledTask(task);
            console.log("Task executed successfully");
        } catch (error) {
            console.error(`Error executing task ${task._id}:`, error);
        } finally {
            job.stop();
        }
    });

    taskJobs[task._id] = job;
};

// Function to execute the scheduled task and fetch post from DB
const executeScheduledTask = async (task) => {
    try {
        // Fetch the generated post using the stored post ID
        const generatedPost = await GeneratedPost.findById(task.generatedPostId);

        if (!generatedPost) {
            console.error(`Generated post not found for task ${task._id}`);
            return;
        }

        // Print fetched data in console
        console.log(`Executing Task: ${task._id}`);
        console.log(`Original Content: ${generatedPost.originalContent}`);
        console.log(`Generated Post: ${generatedPost.generatedContent}`);

        // Uncomment below to send the generated content via an API request
        // await axios.post('https://your-api-endpoint.com/post', { content: generatedPost.generatedContent });

        // Mark task as sent
        task.isSent = true;
        await task.save();
    } catch (error) {
        console.error('Error processing task:', error);
    }
};

// Restore and reschedule tasks on server restart
const restoreScheduledTasks = async () => {
    try {
        const pendingTasks = await ScheduledTask.find({ isSent: false });
        for (const task of pendingTasks) {
            scheduleTaskJob(task);
        }
    } catch (error) {
        console.error('Error restoring scheduled tasks:', error);
    }
};

// Restore scheduled tasks on startup
restoreScheduledTasks();

// Fetch all scheduled tasks
exports.getScheduledTasks = async (req, res) => {
    try {
        const tasks = await ScheduledTask.find();
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Error fetching tasks' });
    }
};

// Generate post content and store it in the database manually
exports.generatePostContent = async (req, res) => {
    const { content } = req.body; 

    try {
        const generatedContent = await generatePostService.generateLinkedInPost(content);

        const newGeneratedPost = new GeneratedPost({
            originalContent: content,
            generatedContent: generatedContent
        });

        await newGeneratedPost.save();

        res.status(200).json({ message: 'Post content generated and saved successfully', generatedPost: newGeneratedPost });
    } catch (error) {
        console.error('Error generating post content:', error);
        res.status(500).json({ message: 'Error generating post content' });
    }
};
