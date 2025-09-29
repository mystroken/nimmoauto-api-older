# Express TypeScript Server

A comprehensive Express server built with TypeScript, featuring multiple APIs for vehicle listings, real estate, WhatsApp integration, social media automation, and more.

## Features

- ✅ **Express.js** with TypeScript
- ✅ **Mongoose** for MongoDB integration
- ✅ **Rate Limiting** for API protection
- ✅ **WhatsApp Web.js** integration for messaging
- ✅ **Puppeteer** for web scraping and automation
- ✅ **Social Media APIs** (Facebook, Twitter)
- ✅ **Blog Scraping** capabilities
- ✅ **Real Estate & Vehicle** listing services
- ✅ **Cron Jobs** for automated tasks
- ✅ **Security Middleware** (Helmet, CORS)
- ✅ **Environment Configuration**
- ✅ **Comprehensive Error Handling**

## Project Structure

```
src/
├── config/
│   └── database.ts                    # MongoDB connection
├── controllers/
│   ├── userController.ts              # User CRUD operations
│   ├── Vehicules.ts                   # Vehicle listing operations
│   ├── immo.ts                        # Real estate operations
│   ├── whatsapp.controller.ts         # WhatsApp messaging
│   ├── blogScrap.ts                   # Blog scraping
│   ├── facebookBot.ts                 # Facebook automation
│   ├── postBot.ts                     # Post automation
│   ├── postiz.ts                      # Postiz integration
│   ├── PostToMeta.ts                  # Meta platform posting
│   └── FBpost.ts                      # Facebook posting
├── middleware/
│   └── rateLimiter.ts                 # Rate limiting middleware
├── models/
│   ├── User.ts                        # User model
│   ├── Vehicule.ts                    # Vehicle model
│   ├── Immobilier.ts                  # Real estate model
│   ├── NewVehiculeService.ts          # Vehicle service
│   └── NewImmobilierService.ts        # Real estate service
├── routes/
│   ├── index.ts                       # Main routes
│   ├── userRoutes.ts                  # User routes
│   ├── Vehicule.ts                    # Vehicle routes
│   ├── Immobilier.routes.ts           # Real estate routes
│   ├── whatsapp.routes.ts             # WhatsApp routes
│   ├── blog.routes.ts                 # Blog routes
│   ├── post.routes.ts                 # Post routes
│   ├── postiz.routes.ts               # Postiz routes
│   ├── facebookBot.routes.ts          # Facebook bot routes
│   └── postToMeta.routes.ts           # Meta posting routes
├── utils/
│   ├── blogScraper.ts                 # Blog scraping utilities
│   ├── getNewServices.ts              # Service utilities
│   └── getNewVehiculeServices.ts      # Vehicle service utilities
└── server.ts                          # Main server file
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/express-typescript-app
NODE_ENV=development

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./whatsapp-session

# Social Media APIs (if using)
FACEBOOK_ACCESS_TOKEN=your_facebook_token
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret

# Webhook URLs (if using)
WEBHOOK_URL=your_webhook_url
```

### 3. Start MongoDB

Make sure MongoDB is running on your system. If you don't have it installed:

- **Windows**: Download from [MongoDB website](https://www.mongodb.com/try/download/community)
- **macOS**: `brew install mongodb-community`
- **Linux**: `sudo apt install mongodb`

### 4. Run the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
- **GET** `/api/health` - Server status

### Users API
- **GET** `/api/users` - Get all users
- **GET** `/api/users/:id` - Get user by ID
- **POST** `/api/users` - Create new user
- **PUT** `/api/users/:id` - Update user
- **DELETE** `/api/users/:id` - Delete user

### Vehicle Listings API
- **GET** `/api/vehicules/all` - Get all vehicles
- **GET** `/api/vehicules/one` - Get a single vehicle
- **GET** `/api/vehicules/new` - Get new vehicles
- **GET** `/api/vehicules/ten` - Get ten vehicles

### Real Estate API
- **GET** `/api/immobilier/all` - Get all real estate listings
- **GET** `/api/immobilier/one` - Get a single listing
- **GET** `/api/immobilier/new` - Get new listings
- **GET** `/api/immobilier/ten` - Get ten listings

### WhatsApp API
- **GET** `/api/whatsapp/status` - Get WhatsApp client status
- **GET** `/api/whatsapp/messages` - Get all messages
- **GET** `/api/whatsapp/messages/latest` - Get latest message
- **GET** `/api/whatsapp/messages/phone/:phoneNumber` - Get messages by phone
- **POST** `/api/whatsapp/send` - Send message
- **POST** `/api/whatsapp/reply` - Send human-like reply
- **POST** `/api/whatsapp/status` - Set WhatsApp status
- **POST** `/api/whatsapp/group/send` - Send group message
- **GET** `/api/whatsapp/groups` - Get groups
- **DELETE** `/api/whatsapp/messages` - Clear messages
- **POST** `/api/whatsapp/webhook/configure` - Configure webhook
- **GET** `/api/whatsapp/webhook/config` - Get webhook configuration
- **GET** `/api/whatsapp/qr` - Get QR code for authentication

### Web Interface
- **GET** `/` - WhatsApp QR Code Scanner (Modern web interface)

### Blog API
- **GET** `/api/blog/*` - Blog scraping endpoints

### Post Management API
- **POST** `/api/post/*` - Post creation and management
- **POST** `/api/postiz/*` - Postiz integration
- **POST** `/api/facebook-bot/*` - Facebook bot operations
- **POST** `/api/meta/*` - Meta platform posting

## Rate Limiting

The API is protected with different rate limiting levels:

- **General API**: 100 requests per 15 minutes
- **Delete operations**: 3 requests per hour (strict)
- **WhatsApp operations**: Rate limited for stability

## WhatsApp Integration

The server includes comprehensive WhatsApp Web.js integration:

- **Automatic Client Initialization** on server start
- **Message Sending & Receiving** capabilities
- **Group Management** features
- **Webhook Support** for real-time updates
- **Human-like Reply** functionality
- **Status Management** tools

## Web Interface

The server includes a modern, responsive web interface for WhatsApp authentication:

### QR Code Scanner Page
- **URL**: `http://localhost:3000/`
- **Features**:
  - Real-time QR code generation and display
  - Automatic status monitoring
  - Modern, responsive design
  - Interactive animations and effects
  - Error handling and retry functionality
  - Mobile-friendly interface

### How to Use the Web Interface
1. Start the server: `npm run dev`
2. Open your browser and navigate to `http://localhost:3000/`
3. Wait for the QR code to generate
4. Open WhatsApp on your phone
5. Go to Settings > Linked Devices
6. Tap "Link a Device"
7. Scan the QR code displayed on the web page
8. The page will automatically detect when connection is successful

### Web Interface Features
- **Real-time Updates**: Automatically checks connection status every 2-5 seconds
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Modern UI**: Clean, professional design with smooth animations
- **Error Handling**: Graceful error handling with retry options
- **Status Indicators**: Visual status indicators showing connection state
- **Keyboard Shortcuts**: Ctrl+R (or Cmd+R) to retry QR code generation

## Web Scraping & Automation

Built-in capabilities for:

- **Blog Content Scraping** with JSDOM
- **Social Media Automation** with Puppeteer
- **Facebook Bot** operations
- **Post Management** across platforms

## Currency

All monetary values in this application use **FCFA** (Franc CFA) as the default currency.

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Mongoose schema validation
- **Error Handling**: Comprehensive error responses
- **File Upload Limits**: 10MB limit for uploads

## Development

The server uses `ts-node-dev` for development with hot reloading. Any changes to TypeScript files will automatically restart the server.

## Production

For production deployment:

1. Set `NODE_ENV=production` in your environment
2. Build the project: `npm run build`
3. Start the server: `npm start`

## Dependencies

### Core Dependencies
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **typescript**: Type safety
- **dotenv**: Environment management

### Social Media & Automation
- **whatsapp-web.js**: WhatsApp integration
- **puppeteer-extra**: Web automation
- **twitter-api-v2**: Twitter API
- **jsdom**: HTML parsing

### Utilities
- **axios**: HTTP client
- **cron**: Scheduled tasks
- **qrcode-terminal**: QR code display

### Security & Middleware
- **helmet**: Security headers
- **cors**: Cross-origin support
- **express-rate-limit**: Rate limiting
- **morgan**: HTTP logging

## Troubleshooting

- **MongoDB Connection Error**: Make sure MongoDB is running and the connection string is correct
- **Port Already in Use**: Change the PORT in your `.env` file
- **TypeScript Errors**: Run `npm run build` to check for compilation errors
- **WhatsApp Connection Issues**: Check session files and ensure proper authentication
- **Rate Limiting**: Check if you've exceeded the rate limits for specific endpoints

## Example Usage

### Create a User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30
  }'
```

### Get Vehicle Listings
```bash
curl http://localhost:3000/api/vehicules/all
```

### Send WhatsApp Message
```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "1234567890",
    "message": "Hello from the API!"
  }'
```

### Check Server Health
```bash
curl http://localhost:3000/api/health
``` 