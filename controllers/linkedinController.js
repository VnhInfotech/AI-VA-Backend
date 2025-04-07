const axios = require('axios');
const querystring = require('querystring');
const User = require('../models/User'); // Import the User model
const linkedinPostService = require('../services/linkedinPostService'); // Import the LinkedIn post service

// Replace with your LinkedIn app credentials
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'YOUR_REDIRECT_URI'; // The URL to redirect to after authentication

// Step 1: Redirect user to LinkedIn for authentication
exports.redirectToLinkedIn = (req, res) => {
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'r_liteprofile w_member_social' // Scopes for profile and posting
    })}`;
    res.redirect(authUrl);
};

// Step 2: Handle the callback from LinkedIn
exports.handleLinkedInCallback = async (req, res) => {
    const { code } = req.query;

    try {
        // Exchange the authorization code for an access token
        const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // Fetch user profile information
        const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const { id: linkedinId, localizedFirstName: firstName, localizedLastName: lastName } = profileResponse.data;

        // Store the LinkedIn ID and access token in the logged-in user's record
        const userId = req.session.userId; // Assuming you store the logged-in user's ID in the session
        const user = await User.findByIdAndUpdate(
            userId,
            { linkedinId, name: `${firstName} ${lastName}`, accessToken },
            { new: true } // Return the updated user
        );

        // Store the access token in the session
        req.session.accessToken = accessToken; // Example using session

        res.status(200).json({ message: 'LinkedIn authentication successful', user });
    } catch (error) {
        console.error('Error getting access token:', error);
        res.status(500).json({ message: 'Error during LinkedIn authentication' });
    }
};

// Step 3: Post to LinkedIn
exports.postToLinkedIn = async (req, res) => {
    const { content, imageUrl } = req.body; // Content and image URL to post
    const userId = req.session.userId; // Get the logged-in user's ID

    try {
        const postResponse = await linkedinPostService.postToLinkedIn(userId, content, imageUrl);
        res.status(200).json({ message: 'Post created successfully', postResponse });
    } catch (error) {
        console.error('Error posting to LinkedIn:', error);
        res.status(500).json({ message: 'Error posting to LinkedIn' });
    }
}; 