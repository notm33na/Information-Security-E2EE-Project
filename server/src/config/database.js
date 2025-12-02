import mongoose from 'mongoose';

/**
 * Connects to MongoDB Atlas
 * @param {string} mongoUri - MongoDB connection string
 */
export async function connectDatabase(mongoUri) {
  try {
    // Ensure database name is included in connection string
    let connectionUri = mongoUri;
    if (!connectionUri.includes('/infosec') && !connectionUri.includes('?') && !connectionUri.includes('#')) {
      // Add database name if not present
      connectionUri = connectionUri.replace(/\/$/, '') + '/infosec';
    }
    
    // Let the official MongoDB driver handle TLS and auth based on the Atlas URI.
    // For Atlas, the URI should normally be the mongodb+srv:// string copied
    // directly from the Atlas UI (with username, password and default db).
    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5000,
      dbName: 'infosec',
    });
    
    console.log('✓ Connected to MongoDB Atlas');
    console.log(`✓ Using database: ${mongoose.connection.db.databaseName}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });
    
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Gracefully closes MongoDB connection
 */
export async function closeDatabase() {
  try {
    await mongoose.connection.close();
    console.log('✓ MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
}

