import { Request, Response } from "express";
import axios from "axios";
import { TwitterApi } from "twitter-api-v2";
import FormData from "form-data";
import { Readable } from "stream";

// Helper: Download image as buffer (for upload APIs)
async function downloadImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 45000 });
    return Buffer.from(response.data, "binary");
  } catch {
    console.log(`Skipping invalid image URL: ${url}`);
    return null;
  }
}

// Helper: Upload video to Facebook in chunks
async function uploadVideoToFacebookChunked({
  fbPageId,
  fbAccessToken,
  videoBuffer,
  title,
  caption
}: {
  fbPageId: string,
  fbAccessToken: string,
  videoBuffer: Buffer,
  title?: string,
  caption: string
}) {
  // Step 1: Start upload session
  const startRes = await axios.post(
    `https://graph.facebook.com/v19.0/${fbPageId}/videos`,
    null,
    {
      params: {
        upload_phase: 'start',
        access_token: fbAccessToken,
        file_size: videoBuffer.length,
      },
    }
  );
  let { upload_session_id, video_id, start_offset, end_offset } = startRes.data;
  const chunkSize = 4 * 1024 * 1024; // 4MB
  // Step 2: Transfer chunks
  while (start_offset !== end_offset) {
    const chunk = videoBuffer.slice(Number(start_offset), Number(end_offset));
    const form = new FormData();
    form.append('video_file_chunk', Readable.from(chunk), { filename: 'chunk.mp4' });
    await axios.post(
      `https://graph.facebook.com/v19.0/${fbPageId}/videos`,
      form,
      {
        params: {
          upload_phase: 'transfer',
          upload_session_id,
          start_offset,
          access_token: fbAccessToken,
        },
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    // Get new offsets for next chunk
    const transferRes = await axios.post(
      `https://graph.facebook.com/v19.0/${fbPageId}/videos`,
      null,
      {
        params: {
          upload_phase: 'transfer',
          upload_session_id,
          start_offset,
          access_token: fbAccessToken,
        },
      }
    );
    start_offset = transferRes.data.start_offset;
    end_offset = transferRes.data.end_offset;
  }
  // Step 3: Finish
  const finishRes = await axios.post(
    `https://graph.facebook.com/v19.0/${fbPageId}/videos`,
    null,
    {
      params: {
        upload_phase: 'finish',
        upload_session_id,
        access_token: fbAccessToken,
        description: `${title ? title + "\n" : ""}${caption}`,
      },
    }
  );
  return { video_id, ...finishRes.data };
}

export const postToAllSocials = async (req: Request, res: Response) => {
  let { imageUrls, imageUrl, title, caption, socials } = req.body;
  
  // Support both imageUrl (single) and imageUrls (array)
  if (!imageUrls && imageUrl) imageUrls = [imageUrl];
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return res.status(400).json({ success: false, message: "imageUrls (array of URLs) and caption are required" });
  }
  if (!caption) {
    return res.status(400).json({ success: false, message: "caption is required" });
  }

  // Default to all socials if none specified
  const platformsToPost = socials || ['facebook', 'instagram', 'linkedin', 'twitter'];
  const results: Record<string, any> = {};

  // 1. Facebook (Page) - upload all images as unpublished, then create a post referencing them
  if (platformsToPost.includes('facebook')) {
    try {
      const fbPageId = process.env.FB_PAGE_ID!;
      const fbAccessToken = process.env.FB_ACCESS_TOKEN!;
      if (imageUrls.length === 1) {
        // Single image: post directly to /photos with published: true
        try {
          const uploadRes = await axios.post(
            `https://graph.facebook.com/v23.0/${fbPageId}/photos`,
            {
              url: imageUrls[0],
              published: true,
              message: `${title ? title + "\n" : ""}${caption}`,
              access_token: fbAccessToken,
            }
          );
          results.facebook = uploadRes.data;
        } catch (err: any) {
          results.facebook = { error: err?.response?.data || err.message || err };
        }
      } else {
        // Multiple images: upload as unpublished, then post to /feed with attached_media
        const photoIds: string[] = [];
        for (const url of imageUrls) {
          const uploadRes = await axios.post(`https://graph.facebook.com/v23.0/${fbPageId}/photos`, {
            url,
            published: false,
            access_token: fbAccessToken,
          });
          photoIds.push(uploadRes.data.id);
        }
        // Now create the post referencing all photo IDs
        const postRes = await axios.post(`https://graph.facebook.com/v23.0/${fbPageId}/feed`, {
          message: `${title ? title + "\n" : ""}${caption}`,
          attached_media: photoIds.map(id => ({ media_fbid: id })),
          access_token: fbAccessToken,
        });
        results.facebook = postRes.data;
      }

      // --- Facebook Story ---
      if (platformsToPost.includes('facebook_story')) {
        try {
          // Only post the first image as a story for simplicity
          const storyRes = await axios.post(`https://graph.facebook.com/v23.0/${fbPageId}/stories`, {
            file_url: imageUrls[0],
            access_token: fbAccessToken,
          });
          results.facebook_story = storyRes.data;
        } catch (err: any) {
          console.log("Facebook Story error:", err?.response?.data || err.message || err);
          results.facebook_story = { error: err?.response?.data || err.message || err };
        }
      }
    } catch (err: any) {
      results.facebook = { error: err?.response?.data || err.message || err };
    }
  }

  // 2. Instagram (carousel if multiple images)
  if (platformsToPost.includes('instagram')) {
    try {
      // Use the Facebook Page access token and the IG user ID linked to the page
      const igUserId = process.env.IG_USER_ID!;
      const fbPageAccessToken = process.env.FB_ACCESS_TOKEN!;
      let publishRes;
      if (imageUrls.length === 1) {
        // Single image
        try {
          const createMediaRes = await axios.post(
            `https://graph.facebook.com/v23.0/${igUserId}/media`,
            {
              image_url: imageUrls[0],
              caption: `${title ? title + "\n" : ""}${caption}`,
              access_token: fbPageAccessToken,
            }
          );
          const creationId = createMediaRes.data.id;
          publishRes = await axios.post(
            `https://graph.facebook.com/v23.0/${igUserId}/media_publish`,
            {
              creation_id: creationId,
              access_token: fbPageAccessToken,
            }
          );
          results.instagram = publishRes.data;
        } catch (err: any) {
          console.log(`Skipping invalid Instagram image URL: ${imageUrls[0]}`);
          results.instagram = { error: err?.response?.data || err.message || err };
        }
      } else {
        // Carousel
        const children: string[] = [];
        for (const url of imageUrls) {
          try {
            const mediaRes = await axios.post(
              `https://graph.facebook.com/v23.0/${igUserId}/media`,
              {
                image_url: url,
                is_carousel_item: true,
                access_token: fbPageAccessToken,
              }
            );
            children.push(mediaRes.data.id);
          } catch {
            console.log(`Skipping invalid Instagram carousel image URL: ${url}`);
          }
        }
        if (children.length === 0) throw new Error("No valid images for Instagram");
        // Create carousel container
        const carouselRes = await axios.post(
          `https://graph.facebook.com/v23.0/${igUserId}/media`,
          {
            media_type: "CAROUSEL",
            children,
            caption: `${title ? title + "\n" : ""}${caption}`,
            access_token: fbPageAccessToken,
          }
        );
        const carouselId = carouselRes.data.id;
        publishRes = await axios.post(
          `https://graph.facebook.com/v23.0/${igUserId}/media_publish`,
          {
            creation_id: carouselId,
            access_token: fbPageAccessToken,
          }
        );
        results.instagram = publishRes.data;
      }

      // --- Instagram Story ---
      if (platformsToPost.includes('instagram_story')) {
        try {
          // Only post the first image as a story for simplicity
          const createStoryRes = await axios.post(
            `https://graph.facebook.com/v23.0/${igUserId}/media`,
            {
              image_url: imageUrls[0],
              media_type: "STORY",
              access_token: fbPageAccessToken,
            }
          );
          const storyCreationId = createStoryRes.data.id;
          const publishStoryRes = await axios.post(
            `https://graph.facebook.com/v23.0/${igUserId}/media_publish`,
            {
              creation_id: storyCreationId,
              access_token: fbPageAccessToken,
            }
          );
          results.instagram_story = publishStoryRes.data;
        } catch (err: any) {
          console.log("Instagram Story error:", err?.response?.data || err.message || err);
          results.instagram_story = { error: err?.response?.data || err.message || err };
        }
      }
    } catch (err: any) {
      if (!results.instagram) results.instagram = { error: err?.response?.data || err.message || err };
    }
  }

  // 3. LinkedIn (only first image)
  if (platformsToPost.includes('linkedin')) {
    try {
      const liAccessToken = process.env.LINKEDIN_ACCESS_TOKEN!;
      console.log(liAccessToken);
      const liUrn = process.env.LINKEDIN_URN!; // e.g. "urn:li:person:xxxx" or "urn:li:organization:xxxx"
      // Step 1: Register upload
      const registerRes = await axios.post(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
        {
          registerUploadRequest: {
            owner: liUrn,
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            serviceRelationships: [
              { identifier: "urn:li:userGeneratedContent", relationshipType: "OWNER" },
            ],
          },
        },
        { headers: { Authorization: `Bearer ${liAccessToken}` } }
      );
      const uploadUrl = registerRes.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
      // Step 2: Upload first image only
      const imageBuffer = await downloadImageBuffer(imageUrls[0]);
      if (!imageBuffer) {
        throw new Error("Failed to download image for LinkedIn");
      }
      await axios.put(uploadUrl, imageBuffer, {
        headers: { "Authorization": `Bearer ${liAccessToken}`, "Content-Type": "image/jpeg" },
      });
      const asset = registerRes.data.value.asset;
      // Step 3: Create post
      const postRes = await axios.post(
        "https://api.linkedin.com/v2/ugcPosts",
        {
          author: liUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: `${title ? title + "\n" : ""}${caption}` },
              shareMediaCategory: "IMAGE",
              media: [{ status: "READY", description: { text: caption }, media: asset, title: { text: title || "" } }],
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        },
        { headers: { Authorization: `Bearer ${liAccessToken}` } }
      );
      results.linkedin = postRes.data;
    } catch (err: any) {
      results.linkedin = { error: err?.response?.data || err.message || err };
    }
  }

  // 4. Twitter (X) - up to 4 images
  if (platformsToPost.includes('twitter')) {
    try {
      const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      });
      const rwClient = twitterClient.readWrite;
      // Download and upload up to 4 images
      const mediaIds: string[] = [];
      for (const url of imageUrls.slice(0, 4)) {
        const imageBuffer = await downloadImageBuffer(url);
        if (imageBuffer) {
          const mediaId = await rwClient.v1.uploadMedia(imageBuffer, { type: "image/jpeg" });
          mediaIds.push(mediaId);
        }
      }
      // Post tweet
      const tweet = await rwClient.v2.tweet({
        text: `${title ? title + "\n" : ""}${caption}`,
        media: { media_ids: mediaIds.slice(0, 4) as [string] | [string, string] | [string, string, string] | [string, string, string, string] },
      });
      results.twitter = tweet.data;
    } catch (err: any) {
      results.twitter = { error: err?.data || err.message || err };
    }
  }

  return res.json({ success: true, results });
};

export const postVideoToAllSocials = async (req: Request, res: Response) => {
  let { videoUrls, videoUrl, title, caption, socials } = req.body;

  // Support both videoUrl (single) and videoUrls (array)
  if (!videoUrls && videoUrl) videoUrls = [videoUrl];
  if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
    return res.status(400).json({ success: false, message: "videoUrls (array of URLs) and caption are required" });
  }
  if (!caption) {
    return res.status(400).json({ success: false, message: "caption is required" });
  }

  // Default to all socials if none specified
  const platformsToPost = socials || ['facebook', 'instagram', 'linkedin', 'twitter'];
  const results: Record<string, any> = {};

  // 1. Facebook Reels (Chunked Upload)
  if (platformsToPost.includes('facebook')) {
    try {
      const fbPageId = process.env.FB_PAGE_ID!;
      const fbAccessToken = process.env.FB_ACCESS_TOKEN!;
      // Only post the first video for simplicity
      const videoBuffer = await downloadImageBuffer(videoUrls[0]);
      if (!videoBuffer) throw new Error("Failed to download video for Facebook");
      const fbResult = await uploadVideoToFacebookChunked({
        fbPageId,
        fbAccessToken,
        videoBuffer,
        title,
        caption
      });
      results.facebook = fbResult;
    } catch (err: any) {
      results.facebook = { error: err?.response?.data || err.message || err };
    }
  }

  // 2. Instagram Reels
  if (platformsToPost.includes('instagram')) {
    try {
      const igUserId = process.env.IG_USER_ID!;
      const fbPageAccessToken = process.env.FB_ACCESS_TOKEN!;
      // Only post the first video for simplicity
      const createReelRes = await axios.post(
        `https://graph.facebook.com/v19.0/${igUserId}/media`,
        {
          video_url: videoUrls[0],
          media_type: "REELS",
          caption: `${title ? title + "\n" : ""}${caption}`,
          access_token: fbPageAccessToken,
        }
      );
      const creationId = createReelRes.data.id;
      const publishRes = await axios.post(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        {
          creation_id: creationId,
          access_token: fbPageAccessToken,
        }
      );
      results.instagram = publishRes.data;
    } catch (err: any) {
      results.instagram = { error: err?.response?.data || err.message || err };
    }
  }

  // 3. LinkedIn Video Post (only first video)
  if (platformsToPost.includes('linkedin')) {
    try {
      const liAccessToken = process.env.LINKEDIN_ACCESS_TOKEN!;
      const liUrn = process.env.LINKEDIN_URN!;
      // Step 1: Register upload
      const registerRes = await axios.post(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
        {
          registerUploadRequest: {
            owner: liUrn,
            recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
            serviceRelationships: [
              { identifier: "urn:li:userGeneratedContent", relationshipType: "OWNER" },
            ],
          },
        },
        { headers: { Authorization: `Bearer ${liAccessToken}` } }
      );
      const uploadUrl = registerRes.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
      // Step 2: Download and upload first video only
      const videoBuffer = await downloadImageBuffer(videoUrls[0]); // Reuse downloadImageBuffer for video
      if (!videoBuffer) {
        throw new Error("Failed to download video for LinkedIn");
      }
      await axios.put(uploadUrl, videoBuffer, {
        headers: { "Authorization": `Bearer ${liAccessToken}`, "Content-Type": "video/mp4" },
      });
      const asset = registerRes.data.value.asset;
      // Step 3: Create post
      const postRes = await axios.post(
        "https://api.linkedin.com/v2/ugcPosts",
        {
          author: liUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: `${title ? title + "\n" : ""}${caption}` },
              shareMediaCategory: "VIDEO",
              media: [{ status: "READY", description: { text: caption }, media: asset, title: { text: title || "" } }],
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        },
        { headers: { Authorization: `Bearer ${liAccessToken}` } }
      );
      results.linkedin = postRes.data;
    } catch (err: any) {
      results.linkedin = { error: err?.response?.data || err.message || err };
    }
  }

  // 4. Twitter (X) Video Post (only first video)
  if (platformsToPost.includes('twitter')) {
    try {
      const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      });
      const rwClient = twitterClient.readWrite;
      // Download and upload first video only
      const videoBuffer = await downloadImageBuffer(videoUrls[0]); // Reuse downloadImageBuffer for video
      if (!videoBuffer) {
        throw new Error("Failed to download video for Twitter");
      }
      const mediaId = await rwClient.v1.uploadMedia(videoBuffer, { type: "video/mp4" });
      // Post tweet
      const tweet = await rwClient.v2.tweet({
        text: `${title ? title + "\n" : ""}${caption}`,
        media: { media_ids: [mediaId] },
      });
      results.twitter = tweet.data;
    } catch (err: any) {
      results.twitter = { error: err?.data || err.message || err };
    }
  }

  return res.json({ success: true, results });
};
