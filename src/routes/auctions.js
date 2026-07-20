const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth')

const auctionController = require('../controllers/auctionController');

// Make sure this path is correct for your project structure!
const upload = require('../middleware/upload'); 

// Public routes
router.get('/', auctionController.getAuctions);
router.get('/:id', auctionController.getAuctionById);

// Protected routes
router.use(protect); 

router.post(
  '/',
  upload.array('images', 5), // This will now work perfectly
  auctionController.createAuction
);

router.patch('/:id', auctionController.updateAuction);
router.delete('/:id', auctionController.cancelAuction);

module.exports = router;