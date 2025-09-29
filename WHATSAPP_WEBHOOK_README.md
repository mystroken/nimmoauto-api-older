# WhatsApp Webhook API

This API provides **true webhook functionality** to automatically receive WhatsApp messages from users. When a message arrives, it **automatically sends an HTTP POST request** to your configured webhook URL with the message data.

## 🚀 **How the Webhook Works:**

1. **Message Received** → WhatsApp client detects new message
2. **Instant Notification** → Automatically sends HTTP POST to your webhook URL
3. **Real-time Processing** → Your application receives the message instantly
4. **No Polling Required** → Messages are pushed to you, not pulled

## Setup Instructions

1. **Start the server**: Run `npm run dev` to start the development server
2. **Scan QR Code**: When the server starts, a QR code will appear in the terminal. Scan it with your WhatsApp mobile app
3. **Configure Webhook URL**: Set up where you want to receive the webhook notifications
4. **Receive Messages**: Messages will be automatically sent to your webhook URL

## Webhook Configuration

### 1. Configure Webhook URL
```
POST /whatsapp/webhook/configure
```

**Request Body:**
```json
{
  "webhookUrl": "https://your-app.com/webhook/whatsapp",
  "webhookSecret": "your-secret-key" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook configured successfully",
  "data": {
    "webhookUrl": "https://your-app.com/webhook/whatsapp",
    "hasSecret": true
  }
}
```

### 2. Check Webhook Configuration
```
GET /whatsapp/webhook/config
```

## Webhook Payload Format

When a message is received, your webhook URL will receive a POST request with this payload:

```json
{
  "event": "whatsapp_message_received",
  "data": {
    "phoneNumber": "1234567890@c.us",
    "message": "Hello from WhatsApp!",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "messageId": "message_id_here"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Headers included:**
- `Content-Type: application/json`
- `X-Webhook-Secret: your-secret-key` (if configured)

## Example Webhook Receiver

Here's how you can set up a simple webhook receiver:

```javascript
// Your webhook endpoint
app.post('/webhook/whatsapp', (req, res) => {
  const { event, data, timestamp } = req.body;
  
  if (event === 'whatsapp_message_received') {
    console.log('New WhatsApp message:', data);
    
    // Process the message
    const { phoneNumber, message } = data;
    
    // Your business logic here
    // Send response, save to database, etc.
  }
  
  res.status(200).json({ received: true });
});
```

## Fallback Endpoints

If your webhook URL is not configured or fails, messages are stored locally and can be retrieved using these endpoints:

### 1. Get All Messages
```
GET /whatsapp/messages
```

### 2. Get Latest Message
```
GET /whatsapp/messages/latest
```

### 3. Get Messages by Phone Number
```
GET /whatsapp/messages/phone/:phoneNumber
```

## Other Endpoints

### Send Message
```
POST /whatsapp/send
```

**Request Body:**
```json
{
  "phoneNumber": "1234567890",
  "message": "Hello from the API!"
}
```

### Get Client Status
```
GET /whatsapp/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isReady": true,
    "totalMessagesReceived": 5,
    "lastMessageReceived": "2024-01-15T10:30:00.000Z",
    "webhookConfigured": true,
    "webhookUrl": "https://your-app.com/webhook/whatsapp"
  }
}
```

### Clear All Messages
```
DELETE /whatsapp/messages
```

## Testing the Webhook

1. **Start the server** and scan the QR code
2. **Configure your webhook URL** using the configure endpoint
3. **Set up a webhook receiver** (like ngrok for testing)
4. **Send a message** to the WhatsApp number you authenticated with
5. **Check your webhook receiver** - you should receive the message instantly!

## Example with ngrok (for testing)

```bash
# Start ngrok to expose your local server
ngrok http 3000

# Configure webhook to point to ngrok URL
curl -X POST http://localhost:3000/whatsapp/webhook/configure \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://your-ngrok-url.ngrok.io/webhook/whatsapp"}'
```

## Important Notes

- **True Webhook**: Messages are automatically pushed to your URL, no polling needed
- **Instant Delivery**: Messages are sent immediately when received
- **Fallback Storage**: If webhook fails, messages are stored locally as backup
- **Security**: Optional webhook secret for authentication
- **Error Handling**: Failed webhook attempts are logged and stored locally
- **Phone Number Format**: Phone numbers include country code (e.g., "1234567890@c.us")

## Currency Note

All monetary values in this system use FCFA (Franc CFA) as the default currency, not dollars ($). 