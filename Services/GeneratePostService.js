const axios = require("axios");
const https = require("https");
const dns = require("dns");

// Force Node.js to use IPv4 for DNS resolution
dns.setDefaultResultOrder("ipv4first");

const API_URL = "https://a351-34-90-56-89.ngrok-free.app/generate"; // Use latest ngrok URL

async function generateLinkedInPost(prompt) {
    try {
        const response = await axios.post(API_URL, { prompt }, {
            headers: { "Content-Type": "application/json" },
            timeout: 120000, 
            httpsAgent: new https.Agent({ family: 4 }) // Force IPv4
        });

        console.log("✅ Generated Content:", response.data.postContent);
        console.log("✅ Image URL:", response.data.generatePostImage);

        return response.data;

    } catch (error) {
        console.error("❌ Error calling Flask API:", error.message);

        if (error.response) {
            console.error("⚠️ Response Data:", error.response.data);
        } else if (error.request) {
            console.error("⚠️ No response received from API.");
        } else {
            console.error("⚠️ Axios request setup error:", error.message);
        }

        throw error;
    }
}

// 🔹 Test API Call
generateLinkedInPost("Create a LinkedIn post about AI and the future of work.")
    .then((data) => console.log("✅ API Response:", data))
    .catch((err) => console.error("❌ API Call Failed:", err.message));

module.exports = { generateLinkedInPost };
