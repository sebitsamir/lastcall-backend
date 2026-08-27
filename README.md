# lastcall-backend# LastCall Backend

Real-time auction marketplace backend with escrow-based bidding.

## Architecture
Client (Next.js)
↓
Express REST API
↓
MongoDB (Atlas)
↓
Socket.IO (real-time)


## Features

- **Authentication**: JWT-based with refresh tokens
- **Auctions**: Create, browse, bid, settle
- **Real-time bidding**: Socket.IO with optimistic concurrency
- **Escrow wallet**: Funds frozen on bid, released on settlement
- **Transactions**: Complete financial ledger
- **Image uploads**: Cloudinary integration
- **Rate limiting**: Protection against abuse
- **Validation**: Joi schemas for all inputs

## Tech Stack

- **Runtime**: Node.js 24
- **Framework**: Express 5
- **Database**: MongoDB + Mongoose
- **Real-time**: Socket.IO
- **Auth**: JWT (access + refresh tokens)
- **Images**: Cloudinary
- **Validation**: Joi
- **Scheduler**: node-cron (settlement jobs)

## Environment Variables

env:

PORT=5000
NODE_ENV=production

# Database
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Client
CLIENT_URL=https://lastcall-frontend.vercel.app

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

Local Development

npm install
npm run dev

Production Deployment
Deployed to Render. Auto-deploys on push to main.
API Endpoints
Public
GET /api/v1/auctions — List active auctions
GET /api/v1/auctions/:id — Get auction details
Authenticated
POST /api/v1/auctions — Create auction
POST /api/v1/auctions/:id/bid — Place bid
GET /api/v1/users/wallet — Get balance
POST /api/v1/users/wallet/deposit — Add funds
Admin
POST /api/v1/settlement/process — Settle completed auctions

License

Proprietary

### 13. Configure ESLint

Create `.eslintrc.json`:

json
{
  "extends": ["eslint:recommended"],
  "env": {
    "node": true,
    "es2024": true
  },
  "parserOptions": {
    "ecmaVersion": "latest"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}

npm run lint
npm run dev

