/**
 * Database Migration Script: Fix Email Index
 * 
 * This script fixes the E11000 duplicate key error by:
 * 1. Dropping the existing email index
 * 2. Creating a new sparse unique index on email field
 * 
 * Run this script once to fix the email index issue.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixEmailIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Coast2Cart');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('accounts');

    // Check if email index exists
    const indexes = await collection.indexes();
    const emailIndex = indexes.find(index => 
      index.key && index.key.email === 1
    );

    if (emailIndex) {
      console.log('Found existing email index:', emailIndex);
      
      // Drop the existing email index
      await collection.dropIndex('email_1');
      console.log('Dropped existing email index');
    }

    // Create a new sparse unique index on email
    await collection.createIndex(
      { email: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'email_sparse_unique'
      }
    );
    console.log('Created new sparse unique email index');

    // Verify the new index
    const newIndexes = await collection.indexes();
    const newEmailIndex = newIndexes.find(index => 
      index.name === 'email_sparse_unique'
    );
    
    if (newEmailIndex) {
      console.log('✅ Email index fixed successfully:', newEmailIndex);
    } else {
      console.log('❌ Failed to create new email index');
    }

  } catch (error) {
    console.error('Error fixing email index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  fixEmailIndex()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = fixEmailIndex;
