const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Full health check - checks if database is actually connected
router.get('/', (req, res) => {
    const dbOK = mongoose.connection.readyState === 1;

    res.status(dbOK ? 200 : 503).json({
        status: dbOK ? 'healthy' : 'unhealthy',
        service: 'LastCall API',
        timestamp: new Date().toISOString(),
        database: dbOK ? 'connected' : 'disconnected',
    });
});

module.exports = router;