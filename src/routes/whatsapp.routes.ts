import { Router } from "express";
import {
  getMessages,
  getLatestMessage,
  getMessagesByPhone,
  sendMessage,
  getClientStatus,
  clearMessages,
  initializeWhatsApp,
  configureWebhook,
  getWebhookConfig,
  sendHumanReply,
  setStatus,
  sendGroupMessage,
  getGroups,
  getQRCode,
  sendVideoMessage,
  sendGroupVideoMessage
} from "../controllers/whatsapp.controller";

const router = Router();

// Initialize WhatsApp client when the server starts
initializeWhatsApp();

// Webhook configuration endpoints
router.post("/webhook/configure", configureWebhook);
router.get("/webhook/config", getWebhookConfig);

// QR code endpoint
router.get("/qr", getQRCode);

// Send video with caption endpoint
router.post("/send-video", sendVideoMessage);

// Send group video with caption endpoint
router.post("/send-group-video", sendGroupVideoMessage);

// Fallback endpoints to get messages (for when webhook fails)
router.get("/messages", getMessages);
router.get("/messages/latest", getLatestMessage);
router.get("/messages/phone/:phoneNumber", getMessagesByPhone);

// Send message endpoint
router.post("/send", sendMessage);

// Client status endpoint
router.get("/status", getClientStatus);

// Clear messages endpoint
router.delete("/messages", clearMessages);

// Send human-like reply endpoint
router.post("/reply", sendHumanReply);

// Set WhatsApp status endpoint
router.post("/status", setStatus);

// Group message endpoints
router.post("/group/send", sendGroupMessage);
router.get("/groups", getGroups);

export default router; 