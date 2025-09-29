import { Request, Response } from "express";
import { Client, LocalAuth, Message, MessageMedia } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import qrcodeWeb from "qrcode";
import axios from "axios";
import fs from 'fs';
import path from 'path';

// Store the WhatsApp client instance
let whatsappClient: Client | null = null;
let isClientReady = false;
let currentQRCode: string | null = null;

// Webhook configuration
let webhookUrl: string | null = null;
let webhookSecret: string | null = null;

// Store received messages for backup/fallback
const receivedMessages: Array<{
  phoneNumber: string;
  message: string;
  timestamp: Date;
  messageId: string;
}> = [];

// Function to send webhook notification
const sendWebhookNotification = async (messageData: {
  phoneNumber: string;
  message: string;
  timestamp: Date;
  messageId: string;
}) => {
  if (!webhookUrl) {
    console.log("No webhook URL configured, message stored locally only");
    return;
  }

  try {
    const payload = {
      event: "whatsapp_message_received",
      data: messageData,
      timestamp: new Date().toISOString()
    };

    const headers: any = {
      'Content-Type': 'application/json'
    };

    // Add webhook secret if configured
    if (webhookSecret) {
      headers['X-Webhook-Secret'] = webhookSecret;
    }

    const response = await axios.post(webhookUrl, payload, { headers });
    console.log(`Webhook sent successfully to ${webhookUrl}, status: ${response.status}`);
  } catch (error) {
    console.error('Error sending webhook notification:', error);
    // Store message locally as fallback
    receivedMessages.push(messageData);
  }
};

// Initialize WhatsApp client
export const initializeWhatsApp = async () => {
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 5000; // 5 seconds

  async function tryInitialize() {
    try {
      whatsappClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Generate QR code for authentication
      whatsappClient.on('qr', (qr) => {
        console.log('QR Code received, scan it with your WhatsApp:');
        qrcode.generate(qr, { small: true });
        currentQRCode = qr; // Store QR code for web display
      });

      // Client is ready
      whatsappClient.on('ready', () => {
        console.log('WhatsApp client is ready!');
        isClientReady = true;
        retryCount = 0; // Reset retry count on success
      });

      // Handle incoming messages - THIS IS THE REAL WEBHOOK
      whatsappClient.on('message', async (message: Message) => {
        if (message.fromMe) return; // Ignore messages sent by the bot
        // Ignore non-user/status messages
        const ignoredTypes = [
          'protocol',
          'gp2',
          'notification',
          'group_notification',
          'broadcast_notification'
        ];
        if (ignoredTypes.includes(message.type)) return;
        if (message.from === 'status@broadcast') return;

        const phoneNumber = message.from;
        const messageText = message.body;
        const timestamp = new Date();
        const messageId = message.id._serialized;

        const messageData = {
          phoneNumber,
          message: messageText,
          timestamp,
          messageId
        };

        console.log(`New message from ${phoneNumber}: ${messageText}`);

        // SEND WEBHOOK NOTIFICATION IMMEDIATELY
        await sendWebhookNotification(messageData);
      });

      // Handle authentication failure
      whatsappClient.on('auth_failure', (msg) => {
        console.error('WhatsApp authentication failed:', msg);
        isClientReady = false;
      });

      // Handle disconnection
      whatsappClient.on('disconnected', (reason) => {
        console.log('WhatsApp client disconnected:', reason);
        isClientReady = false;
        // Attempt to re-initialize on disconnect
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryInitialize, retryDelay);
        }
      });

      // Initialize the client
      await whatsappClient.initialize();

    } catch (error: any) {
      console.error('Error initializing WhatsApp client:', error);
      // Retry on ProtocolError or Execution context errors
      if (
        retryCount < maxRetries &&
        (error.message?.includes('Protocol error') || error.message?.includes('Execution context was destroyed'))
      ) {
        retryCount++;
        console.log(`Retrying WhatsApp client initialization in ${retryDelay / 1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
        setTimeout(tryInitialize, retryDelay);
      }
    }
  }

  tryInitialize();
};

// Configure webhook URL
export const configureWebhook = async (req: Request, res: Response) => {
  try {
    const { webhookUrl: url, webhookSecret: secret } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Webhook URL is required"
      });
    }

    webhookUrl = url;
    webhookSecret = secret || null;

    res.status(200).json({
      success: true,
      message: "Webhook configured successfully",
      data: {
        webhookUrl: url,
        hasSecret: !!webhookSecret
      }
    });

  } catch (error) {
    console.error('Error configuring webhook:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Get webhook configuration
export const getWebhookConfig = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        webhookUrl,
        hasSecret: !!webhookSecret,
        isConfigured: !!webhookUrl
      }
    });

  } catch (error) {
    console.error('Error getting webhook config:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Webhook endpoint to get all received messages (fallback)
export const getMessages = async (req: Request, res: Response) => {
  try {
    if (!isClientReady) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first.",
        data: []
      });
    }

    res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      data: receivedMessages,
      totalMessages: receivedMessages.length
    });

  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Webhook endpoint to get the latest message (fallback)
export const getLatestMessage = async (req: Request, res: Response) => {
  try {
    if (!isClientReady) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first.",
        data: null
      });
    }

    const latestMessage = receivedMessages[receivedMessages.length - 1];

    res.status(200).json({
      success: true,
      message: "Latest message retrieved successfully",
      data: latestMessage || null
    });

  } catch (error) {
    console.error('Error getting latest message:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Webhook endpoint to get messages from a specific phone number (fallback)
export const getMessagesByPhone = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;

    if (!isClientReady) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first.",
        data: []
      });
    }

    const messagesFromPhone = receivedMessages.filter(
      msg => msg.phoneNumber === phoneNumber
    );

    res.status(200).json({
      success: true,
      message: `Messages from ${phoneNumber} retrieved successfully`,
      data: messagesFromPhone,
      totalMessages: messagesFromPhone.length
    });

  } catch (error) {
    console.error('Error getting messages by phone:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Send message to a specific phone number
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message, imageUrl } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: "Phone number and message are required"
      });
    }

    if (!isClientReady || !whatsappClient) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first."
      });
    }

    // Format phone number (remove any non-digit characters and add country code if needed)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const chatId = `${formattedPhone}@c.us`;

    const sentMessage = await whatsappClient.sendMessage(chatId, message);
    let sentImage = null;
    if (imageUrl) {
      const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
      sentImage = await whatsappClient.sendMessage(chatId, media);
    }

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: {
        messageId: sentMessage.id._serialized,
        imageMessageId: sentImage ? sentImage.id._serialized : undefined,
        phoneNumber: formattedPhone,
        message: message,
        imageUrl: imageUrl || undefined,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Get client status
export const getClientStatus = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        isReady: isClientReady,
        totalMessagesReceived: receivedMessages.length,
        lastMessageReceived: receivedMessages[receivedMessages.length - 1]?.timestamp || null,
        webhookConfigured: !!webhookUrl,
        webhookUrl: webhookUrl || null
      }
    });

  } catch (error) {
    console.error('Error getting client status:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Get QR code for web display
export const getQRCode = async (req: Request, res: Response) => {
  try {
    if (isClientReady) {
      return res.status(200).json({
        success: true,
        message: "WhatsApp client is already authenticated",
        data: {
          isAuthenticated: true,
          qrCode: null
        }
      });
    }

    if (!currentQRCode) {
      return res.status(404).json({
        success: false,
        message: "QR code not available. Please wait for the client to generate one.",
        data: {
          isAuthenticated: false,
          qrCode: null
        }
      });
    }

    // Generate QR code as data URL
    const qrCodeDataUrl = await qrcodeWeb.toDataURL(currentQRCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.status(200).json({
      success: true,
      message: "QR code generated successfully",
      data: {
        isAuthenticated: false,
        qrCode: qrCodeDataUrl
      }
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Clear all stored messages
export const clearMessages = async (req: Request, res: Response) => {
  try {
    const messageCount = receivedMessages.length;
    receivedMessages.length = 0;

    res.status(200).json({
      success: true,
      message: `Cleared ${messageCount} messages successfully`,
      data: {
        clearedCount: messageCount
      }
    });

  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Generate a human-like reply (simple template-based for now)
function generateHumanLikeReply(userMessage: string): string {
  // Simple, friendly, and human-like responses
  const templates = [
    `Thank you for your message! 😊\n\nYou said: "${userMessage}". How can I assist you further?`,
    `Hi there! I received: "${userMessage}". Let me know if you need anything else!`,
    `Hello! Thanks for reaching out. You mentioned: "${userMessage}". How can I help?`,
    `I appreciate your message: "${userMessage}". What would you like to do next?`
  ];
  // Pick a random template
  return templates[Math.floor(Math.random() * templates.length)];
}

// Controller to send a human-like reply
export const sendHumanReply = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: "Phone number and message are required"
      });
    }

    if (!isClientReady || !whatsappClient) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first."
      });
    }

    // Generate a human-like reply
    const reply = generateHumanLikeReply(message);

    // Format phone number (remove any non-digit characters and add country code if needed)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const chatId = `${formattedPhone}@c.us`;

    const sentMessage = await whatsappClient.sendMessage(chatId, reply);

    res.status(200).json({
      success: true,
      message: "Human-like reply sent successfully",
      data: {
        messageId: sentMessage.id._serialized,
        phoneNumber: formattedPhone,
        reply,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Error sending human-like reply:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Set WhatsApp status
export const setStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    if (!isClientReady || !whatsappClient) {
      return res.status(503).json({ success: false, message: 'WhatsApp client is not ready. Please scan the QR code first.' });
    }
    await whatsappClient.setStatus(status);
    res.status(200).json({ success: true, message: 'Status updated successfully', status });
  } catch (error) {
    console.error('Error setting status:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Send message to WhatsApp group
export const sendGroupMessage = async (req: Request, res: Response) => {
  try {
    const { groupId, message, imageUrl, imageUrls } = req.body;

    if (!groupId || !message) {
      return res.status(400).json({
        success: false,
        message: "Group ID and message are required"
      });
    }

    if (!isClientReady || !whatsappClient) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first."
      });
    }

    // Format group ID (should end with @g.us for groups)
    const formattedGroupId = groupId.endsWith('@g.us') ? groupId : `${groupId}@g.us`;

    // Check if the group exists
    const chat = await whatsappClient.getChatById(formattedGroupId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Group not found. Please check the group ID."
      });
    }

    // Support both single imageUrl and multiple imageUrls
    let imagesToSend: string[] = [];
    if (imageUrls && Array.isArray(imageUrls)) {
      imagesToSend = imageUrls;
    } else if (imageUrl) {
      imagesToSend = [imageUrl];
    }

    // Download images to temp files
    const tempImagePaths: string[] = [];
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    for (const url of imagesToSend) {
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const ext = path.extname(url) || '.jpg';
        const tempPath = path.join(__dirname, `temp_whatsapp_${Date.now()}${ext}`);
        fs.writeFileSync(tempPath, response.data);
        tempImagePaths.push(tempPath);
      } catch (err) {
        console.error(`Failed to download image: ${url}`, err);
      }
    }

    // Send text message
    const sentMessage = await whatsappClient.sendMessage(formattedGroupId, message);
    const sentImages: string[] = [];

    // Send multiple images if provided
    if (tempImagePaths.length > 0) {
      for (const tempPath of tempImagePaths) {
        try {
          const media = MessageMedia.fromFilePath(tempPath);
          const sentImage = await whatsappClient.sendMessage(formattedGroupId, media);
          sentImages.push(sentImage.id._serialized);
        } catch (imageError) {
          console.error(`Error sending image ${tempPath} to group:`, imageError);
          // Continue with other images even if one fails
        }
      }
    }

    // Clean up temp files
    for (const tempPath of tempImagePaths) {
      try { fs.unlinkSync(tempPath); } catch {}
    }

    res.status(200).json({
      success: true,
      message: "Group message sent successfully",
      data: {
        messageId: sentMessage.id._serialized,
        imageMessageIds: sentImages,
        groupId: formattedGroupId,
        groupName: chat.name || 'Unknown Group',
        message: message,
        imageUrls: imagesToSend,
        totalImagesSent: sentImages.length,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Error sending group message:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Get all groups (helper function to find group IDs)
export const getGroups = async (req: Request, res: Response) => {
  try {
    if (!isClientReady || !whatsappClient) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first."
      });
    }

    const chats = await whatsappClient.getChats();
    const groups = chats.filter(chat => chat.isGroup);

    const groupsList = groups.map(group => ({
      id: group.id._serialized,
      name: group.name,
      participantsCount: 0, // Will be updated when we can access participants
      isGroup: group.isGroup
    }));

    res.status(200).json({
      success: true,
      message: "Groups retrieved successfully",
      data: groupsList,
      totalGroups: groupsList.length
    });

  } catch (error) {
    console.error('Error getting groups:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Send video to a specific phone number with caption
export const sendVideoMessage = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, videoUrl, caption } = req.body;

    if (!phoneNumber || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: "Phone number and videoUrl are required"
      });
    }

    if (!isClientReady || !whatsappClient) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first."
      });
    }

    // Format phone number (remove any non-digit characters and add country code if needed)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    const chatId = `${formattedPhone}@c.us`;

    // Download and send the video
    const media = await MessageMedia.fromUrl(videoUrl, { unsafeMime: true });
    const sentMessage = await whatsappClient.sendMessage(chatId, media, { caption });

    res.status(200).json({
      success: true,
      message: "Video sent successfully",
      data: {
        messageId: sentMessage.id._serialized,
        phoneNumber: formattedPhone,
        videoUrl,
        caption,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error sending video message:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Send video to a WhatsApp group with caption
export const sendGroupVideoMessage = async (req: Request, res: Response) => {
  let tempPath: string | null = null;
  
  try {
    const { groupId, videoUrl, caption } = req.body;

    if (!groupId || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: "groupId and videoUrl are required"
      });
    }

    if (!isClientReady || !whatsappClient) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready. Please scan the QR code first."
      });
    }

    console.log('🔄 Starting video download from:', videoUrl);
    console.log('📱 Target group:', groupId);

    // Format group ID (should end with @g.us for groups)
    const formattedGroupId = groupId.endsWith('@g.us') ? groupId : `${groupId}@g.us`;
    console.log('✅ Formatted group ID:', formattedGroupId);

    // Download video to temp file
    const tempDir = path.join(__dirname, '../../temp_videos');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('📁 Created temp directory:', tempDir);
    }
    
    const urlObj = new URL(videoUrl);
    const ext = path.extname(urlObj.pathname) || '.mp4';
    tempPath = path.join(tempDir, `video_${Date.now()}${ext}`);
    
    console.log('📥 Downloading video...');
    console.log('📄 File extension:', ext);
    console.log('💾 Temp path:', tempPath);
    
    const response = await axios.get(videoUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024 // 50MB max
    });
    
    console.log('📊 Download completed. Size:', response.data.length, 'bytes');
    
    // Check file size (WhatsApp limit is ~16MB for videos)
    const fileSizeMB = response.data.length / (1024 * 1024);
    if (fileSizeMB > 16) {
      throw new Error(`Video file too large: ${fileSizeMB.toFixed(2)}MB. WhatsApp limit is 16MB.`);
    }
    
    fs.writeFileSync(tempPath, response.data);
    const fileStats = fs.statSync(tempPath);
    console.log('💾 File saved. Size on disk:', fileStats.size, 'bytes');

    // Verify the file is readable
    try {
      const testRead = fs.readFileSync(tempPath);
      console.log('✅ File is readable. Read size:', testRead.length, 'bytes');
    } catch (readError) {
      throw new Error('Downloaded file is not readable');
    }

    console.log('🚀 Attempting to send video to WhatsApp...');
    
    // Try multiple approaches to send the video
    let sentMessage = null;
    let lastError = null;

    // Method 1: Try with MessageMedia.fromFilePath
    try {
      console.log('📹 Method 1: Using MessageMedia.fromFilePath...');
      const media = MessageMedia.fromFilePath(tempPath);
      console.log('✅ MessageMedia created successfully');
      console.log('📹 Media type:', media.mimetype);
      
      sentMessage = await whatsappClient.sendMessage(formattedGroupId, media, { caption });
      console.log('✅ Video sent successfully with Method 1!');
    } catch (error1: any) {
      console.log('❌ Method 1 failed:', error1.message);
      lastError = error1;
      
      // Method 2: Try with MessageMedia.fromUrl (direct URL)
      try {
        console.log('📹 Method 2: Using MessageMedia.fromUrl...');
        const media = await MessageMedia.fromUrl(videoUrl, { unsafeMime: true });
        console.log('✅ MessageMedia from URL created successfully');
        
        sentMessage = await whatsappClient.sendMessage(formattedGroupId, media, { caption });
        console.log('✅ Video sent successfully with Method 2!');
      } catch (error2: any) {
        console.log('❌ Method 2 failed:', error2.message);
        lastError = error2;
        
        // Method 3: Try sending as document if video fails
        try {
          console.log('📹 Method 3: Trying as document...');
          const media = MessageMedia.fromFilePath(tempPath);
          sentMessage = await whatsappClient.sendMessage(formattedGroupId, media, { 
            sendMediaAsDocument: true,
            caption 
          });
          console.log('✅ Video sent successfully as document!');
        } catch (error3: any) {
          console.log('❌ Method 3 failed:', error3.message);
          lastError = error3;
          throw new Error(`All upload methods failed. Last error: ${error3.message}`);
        }
      }
    }

    // Clean up temp file
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log('🗑️ Temp file deleted');
    }

    res.status(200).json({
      success: true,
      message: "Group video sent successfully",
      data: {
        messageId: sentMessage?.id._serialized,
        groupId: formattedGroupId,
        videoUrl,
        caption,
        fileSize: fileStats.size,
        fileSizeMB: fileSizeMB.toFixed(2),
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error in sendGroupVideoMessage:', error);
    
    // Clean up temp file if it exists
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
        console.log('🗑️ Temp file cleaned up after error');
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup temp file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to send video to WhatsApp group",
      error: error instanceof Error ? error.message : "Unknown error",
      details: {
        videoUrl: req.body.videoUrl,
        groupId: req.body.groupId,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        suggestion: "Try with a smaller video file (<16MB) or different video format (MP4 with H.264)"
      }
    });
  }
}; 