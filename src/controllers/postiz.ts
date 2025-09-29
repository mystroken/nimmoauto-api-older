import axios from 'axios';
import { Request, Response } from 'express';

const POSTIZ_API_URL = 'http://localhost:5000/public/v1'; // Local Postiz instance

export const postToSocialMedia = async (req: Request, res: Response) => {
  // Use API key from body or fallback to environment variable
  const apiKey = req.body.apiKey || process.env.POSTIZ_API_KEY;
  const { content, tags, date, platforms, integrationIds } = req.body;

  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'API key is required. Provide it in the request or set POSTIZ_API_KEY in your environment.' });
  }

  try {
    let targetIntegrationIds = integrationIds;

    // If platforms are provided, fetch integrations and map to IDs
    if (platforms && Array.isArray(platforms)) {
      const integrationsRes = await axios.get(`${POSTIZ_API_URL}/integrations`, {
        headers: { Authorization: apiKey },
      });
      let integrations = integrationsRes.data;
      if (Array.isArray(integrations)) {
        // do nothing, already array
      } else if (Array.isArray(integrations.integrations)) {
        integrations = integrations.integrations;
      } else {
        return res.status(500).json({ success: false, error: 'Invalid integrations response from Postiz API.' });
      }
      targetIntegrationIds = integrations
        .filter((i: any) => platforms.includes(i.identifier))
        .map((i: any) => i.id);
    }

    if (!targetIntegrationIds || !Array.isArray(targetIntegrationIds) || targetIntegrationIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid integration IDs found for requested platforms.' });
    }

    const posts = targetIntegrationIds.map((id: string) => ({
      integration: { id },
      value: [{ content }],
    }));

    const response = await axios.post(
      `${POSTIZ_API_URL}/posts`,
      {
        type: 'now',
        date: date || new Date().toISOString(),
        shortLink: false,
        tags: tags || [],
        posts,
      },
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
};
