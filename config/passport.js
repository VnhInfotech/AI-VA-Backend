const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const User = require('../models/User');

// ===================== GOOGLE STRATEGY =====================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists in our db
      let user = await User.findOne({ googleId: profile.id });
      
      if (!user) {
        // If not, create a new user in our db
        user = await new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          profilePicture: profile.photos[0].value,
          password: '' // Set a default password or leave it blank
        }).save();
      }
      
      return done(null, user);
    } catch (error) {
      console.error('Error in Google strategy:', error);
      return done(error, null);
    }
  }
));

// ===================== LINKEDIN STRATEGY =====================
passport.use(new LinkedInStrategy({
    clientID: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    callbackURL: process.env.LINKEDIN_CALLBACK_URL,
    scope: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
    state: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ linkedinId: profile.id });

      if (!user) {
        user = await new User({
          linkedinId: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value,
          profilePicture: profile.photos?.[0]?.value,
          linkedinAccessToken: accessToken,
          password: ''
        }).save();
      } else {
        // Update token if needed
        user.linkedinAccessToken = accessToken;
        await user.save();
      }

      return done(null, user);
    } catch (error) {
      console.error('Error in LinkedIn strategy:', error);
      return done(error, null);
    }
  }
));

// ===================== SERIALIZE / DESERIALIZE =====================
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id).then((user) => {
    done(null, user);
  });
}); 