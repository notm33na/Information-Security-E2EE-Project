import helmet from 'helmet';
import cors from 'cors';

/**
 * HTTPS Enforcement Middleware
 * In production mode, blocks HTTP requests and only allows HTTPS
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function enforceHttps(req, res, next) {
  // Only enforce in production mode
  if (process.env.NODE_ENV === 'production') {
    // Check if request is secure
    // req.secure is true when behind a proxy that terminates SSL (like nginx)
    // x-forwarded-proto header is set by proxies
    const isSecure = req.secure || 
                     req.headers['x-forwarded-proto'] === 'https' ||
                     req.connection?.encrypted === true;
    
    if (!isSecure) {
      // Reject HTTP requests in production
      return res.status(403).json({
        success: false,
        error: 'HTTPS required',
        message: 'This endpoint requires HTTPS. Please use https:// instead of http://'
      });
    }
  }
  
  // Allow request to proceed
  next();
}

/**
 * Security middleware configuration
 * Sets up Helmet and CORS with secure defaults
 */
export function setupSecurityMiddleware(app) {
  // HTTPS Enforcement: Must be first to block HTTP requests early
  app.use(enforceHttps);

  // Helmet: Sets various HTTP headers for security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS: Configure cross-origin resource sharing
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CLIENT_URL || 'https://localhost:5173'
      : ['http://localhost:5173', 'https://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
}

