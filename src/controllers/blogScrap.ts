import { Request, Response } from 'express';
import { scrapeBlog } from '../utils/blogScraper';

export const getLink = async (req: Request, res: Response) => {
    try {
        const { link } = req.body;
        if (!link) {
            return res.status(400).json({ message: 'Link is required' });
        }

        console.log('Scraping blog from:', link);
        
        // Validate URL format
        try {
            new URL(link);
        } catch (error) {
            return res.status(400).json({ message: 'Invalid URL format' });
        }

        // Scrape the blog content
        const blogData = await scrapeBlog(link);

        res.status(200).json({ 
            message: 'Blog scraped successfully', 
            data: blogData 
        });
    } catch (error) {
        console.error('Error scraping blog:', error);
        res.status(500).json({ 
            message: 'Error scraping blog', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
}