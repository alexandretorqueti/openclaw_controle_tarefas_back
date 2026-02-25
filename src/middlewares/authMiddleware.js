const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configure session
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn('⚠️  SESSION_SECRET not set. Using a default for development only.');
}

const sessionConfig = {
  secret: sessionSecret || 'dev-only-insecure-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

// Configure Passport
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL;

if (!googleClientId || !googleClientSecret) {
  console.warn('⚠️  GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Google OAuth will not work.');
}

console.log('🔧 Configuring Google OAuth with callback:', googleCallbackUrl || 'Not set');
passport.use(new GoogleStrategy({
    clientID: googleClientId,
    clientSecret: googleClientSecret,
    callbackURL: googleCallbackUrl
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔐 Google OAuth profile received:', profile.id);
      
      // Try to find user by googleId first
      let user = await prisma.user.findUnique({
        where: { googleId: profile.id }
      });

      if (!user) {
        // Try to find by email
        user = await prisma.user.findUnique({
          where: { email: profile.emails[0].value }
        });

        if (user) {
          // Update existing user with googleId
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.id,
              accessToken,
              refreshToken,
              avatarUrl: profile.photos[0]?.value || user.avatarUrl
            }
          });
          console.log('👤 Existing user updated with Google OAuth:', user.email);
        } else {
          // Create new user
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              name: profile.displayName,
              email: profile.emails[0].value,
              avatarUrl: profile.photos[0]?.value,
              accessToken,
              refreshToken,
              role: 'Viewer' // Default role
            }
          });
          console.log('👤 New user created with Google OAuth:', user.email);
        }
      } else {
        // Update tokens for existing Google user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken,
            refreshToken,
            avatarUrl: profile.photos[0]?.value || user.avatarUrl
          }
        });
        console.log('👤 Existing Google user updated:', user.email);
      }

      return done(null, user);
    } catch (error) {
      console.error('❌ Error in Google OAuth strategy:', error);
      return done(error, null);
    }
  }
));

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // If not authenticated, return 401
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Please log in to access this resource'
  });
};

// Middleware to get current user
const getCurrentUser = (req, res, next) => {
  if (req.isAuthenticated()) {
    req.user = req.user;
  } else {
    req.user = null;
  }
  next();
};

module.exports = {
  passport,
  sessionConfig,
  isAuthenticated,
  getCurrentUser
};
