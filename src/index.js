require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const DB = process.env.MONGODB_URI;

// 1. Log what we are connecting to
console.log('🔍 Attempting to connect to MongoDB...');

// 2. Connect to the database
mongoose.connect(DB)
    .then(() => {
        // This ONLY runs if the connection is 100% successful
        console.log('MongoDB Connected Successfully!');
    
        // 3. Start the server ONLY after the database is connected
        app.listen(PORT, () => {
            console.log(`LastCall API is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        // This runs if the connection fails
        console.error('MongoDB Connection FAILED!');
        console.error('Error details:', err.message);
        process.exit(1); // Kill the app completely so we can fix the issue
});