const axios = require('axios');
const User = require('../models/User'); // Import the User model

// Function to post content and image to LinkedIn
const postToLinkedIn = async (userId, content, imageUrl) => {
    try {
        // Find the user in the database
        const user = await User.findById(userId);
        if (!user || !user.accessToken) {
            throw new Error('User not authenticated or access token not found');
        }

        // Prepare the post data
        const postData = {
            author: `urn:li:person:${user.linkedinId}`, // Use the user's LinkedIn ID
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: content
                    },
                    shareMediaCategory: 'IMAGE',
                    media: [
                        {
                            status: 'READY',
                            description: {
                                text: 'Image description' // Optional description
                            },
                            media: imageUrl, // URL of the image
                            title: {
                                text: 'Image Title' // Optional title
                            }
                        }
                    ]
                }
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
            }
        };

        // Make the request to LinkedIn API
        const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
            headers: {
                Authorization: `Bearer ${user.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data; // Return the response from LinkedIn
    } catch (error) {
        console.error('Error posting to LinkedIn:', error);
        throw error; // Rethrow the error for handling in the calling function
    }
};

module.exports = { postToLinkedIn }; 