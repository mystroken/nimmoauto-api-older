import { Router } from "express";
import { postToAllSocials, postVideoToAllSocials } from "../controllers/Post";
import { postFacebookStoryBot } from "../controllers/postBot";
const router = Router();

router.post("/post-to-socials", postToAllSocials);
router.post("/post-video-to-socials", postVideoToAllSocials);
router.post("/bot/facebook-story", postFacebookStoryBot);

// OAuth callback endpoints for each social
router.get("/auth/facebook/callback", (req, res) => res.send("Facebook OAuth callback received!"));
router.get("/auth/instagram/callback", (req, res) => res.send("Instagram OAuth callback received!"));
router.get("/auth/linkedin/callback", (req, res) => res.send("LinkedIn OAuth callback received!"));
router.get("/auth/twitter/callback", (req, res) => res.send("Twitter OAuth callback received!"));

export default router; 