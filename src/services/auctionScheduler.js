// src/services/auctionScheduler.js
const cron = require("node-cron");
const Auction = require("../models/Auction");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

/**
 * Starts the background job to settle ended auctions.
 * Should be invoked once when the server boots (in server.js or index.js).
 */
const startAuctionScheduler = () => {
    // Run every minute ("* * * * *")
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();

            // Find all active auctions where the endTime has passed
            const endedAuctions = await Auction.find({
                status: "active",
                endTime: { $lte: now },
            }).populate("highestBidder seller");

            if (endedAuctions.length === 0) return;

            for (const auction of endedAuctions) {
                try {
                    // 1. Mark auction as completed
                    auction.status = "completed";
                    await auction.save();

                    // 2. If there is a winning bid, settle the escrow funds
                    if (auction.highestBidder && auction.currentBid > 0) {
                        const buyer = auction.highestBidder;
                        const seller = auction.seller;

                        // Deduct from buyer's frozen balance (escrow release)
                        buyer.frozenBalance = Math.max(0, (buyer.frozenBalance || 0) - auction.currentBid);
                        await buyer.save({ validateBeforeSave: false });

                        // Add to seller's available balance (payout)
                        seller.availableBalance = (seller.availableBalance || 0) + auction.currentBid;
                        await seller.save({ validateBeforeSave: false });

                        // Record ledger entries for both parties
                        await Transaction.create([
                            {
                                user: buyer._id,
                                type: "purchase",
                                amount: auction.currentBid,
                                description: `Won auction: ${auction.title}`,
                            },
                            {
                                user: seller._id,
                                type: "payout",
                                amount: auction.currentBid,
                                description: `Sold auction: ${auction.title}`,
                            },
                        ]);

                        console.log(`[Scheduler] Settled auction ${auction._id} for $${auction.currentBid}`);
                    }
                } catch (err) {
                    console.error(`[Scheduler] Failed to settle auction ${auction._id}:`, err);
                }
            }
        } catch (error) {
            console.error("[Scheduler] Critical failure:", error);
        }
    });

    console.log("✅ Auction settlement scheduler started.");
};

module.exports = startAuctionScheduler;