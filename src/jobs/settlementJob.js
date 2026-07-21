const cron = require('node-cron');
const { checkAndSettleEndedAuctions } = require('../controllers/settlementController');

// Schedule the job to run every minute
// Format: second minute hour day weekday month
// "0 * * * * *" = every minute at 0 seconds
const settlementJob = cron.schedule("0 * * * * *", async () => {
    console.log("[Cron] Running auction settlement check...");

    try {
        const result = await checkAndSettleEndedAuctions();
        console.log(`[Cron] Settlement check complete. Settled ${result.settled} auction(s)`);
    } catch (error) {
        console.log("[Cron] Settlement job failed", error);
    }
});

// Export the job so that it can be stopped if needed(useful for testing)
module.exports = settlementJob;