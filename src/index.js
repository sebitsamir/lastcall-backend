require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// 1. Connect to Database
connectDB().then(() => {
    // 2. Start Server ONLY after DB is connected
    const server = app.listen(PORT, () => {
        logger.info(`LastCall API is running on port ${PORT}`);
    });
    
    // 3. Handle Unhandled Rejections (Graceful Shutdown Prep)
    process.on('unhandledRejection', (err) => {
        logger.error('UNHANDLED REJECTION! Shutting down...');
        logger.error(err.name, err.message);
        server.close(() => {
            process.exit(1);
        });
    });
});