import { JSDOM } from 'jsdom';

interface BlogData {
    title: string;
    content: string;
    author?: string;
    publishDate?: string;
    description?: string;
    imageUrl?: string;
    url: string;
}

export const scrapeBlog = async (url: string): Promise<BlogData> => {
    try {
        // Fetch the webpage content
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Extract title
        const title = document.querySelector('h1')?.textContent?.trim() ||
                     document.querySelector('title')?.textContent?.trim() ||
                     document.querySelector('[property="og:title"]')?.getAttribute('content') ||
                     'No title found';

        // Extract content - try multiple selectors for different blog platforms
        const contentSelectors = [
            'article',
            '.post-content',
            '.entry-content',
            '.blog-content',
            '.content',
            'main',
            '[role="main"]'
        ];

        let content = '';
        let contentElement: Element | null = null;
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                content = element.textContent?.trim() || '';
                contentElement = element;
                if (content.length > 100) break; // Found substantial content
            }
        }

        // If no substantial content found, try to get body content
        if (content.length < 100) {
            const body = document.querySelector('body');
            content = body?.textContent?.trim() || 'No content found';
            contentElement = body;
        }

        // Check for 'lire la suite' or similar phrases and try to follow the link
        let fullContent = content;
        if (contentElement && /lire la suite|read more|voir plus/i.test(contentElement.textContent || '')) {
            // Try to find a link or button near the phrase
            const lireLaSuiteLink = Array.from(contentElement.querySelectorAll('a, button')).find(el =>
                /lire la suite|read more|voir plus/i.test(el.textContent || '')
            );
            if (lireLaSuiteLink) {
                let moreUrl = lireLaSuiteLink.getAttribute('href');
                // If it's a button, try data-url or similar
                if (!moreUrl && lireLaSuiteLink.tagName.toLowerCase() === 'button') {
                    moreUrl = lireLaSuiteLink.getAttribute('data-url');
                }
                // If the link is relative, resolve it
                if (moreUrl && !/^https?:\/\//i.test(moreUrl)) {
                    const base = new URL(url);
                    moreUrl = new URL(moreUrl, base).href;
                }
                if (moreUrl) {
                    try {
                        const moreResponse = await fetch(moreUrl);
                        if (moreResponse.ok) {
                            const moreHtml = await moreResponse.text();
                            const moreDom = new JSDOM(moreHtml);
                            const moreDoc = moreDom.window.document;
                            // Try to extract the main content again from the new page
                            let moreContent = '';
                            for (const selector of contentSelectors) {
                                const el = moreDoc.querySelector(selector);
                                if (el) {
                                    moreContent = el.textContent?.trim() || '';
                                    if (moreContent.length > 100) break;
                                }
                            }
                            if (moreContent.length < 100) {
                                const moreBody = moreDoc.querySelector('body');
                                moreContent = moreBody?.textContent?.trim() || '';
                            }
                            if (moreContent) {
                                fullContent += '\n' + moreContent;
                            }
                        }
                    } catch (e) {
                        // Ignore errors from fetching the additional content
                    }
                }
            }
        }

        // Extract author
        const author = document.querySelector('[rel="author"]')?.textContent?.trim() ||
                      document.querySelector('.author')?.textContent?.trim() ||
                      document.querySelector('[property="article:author"]')?.getAttribute('content') ||
                      undefined;

        // Extract publish date
        const publishDate = document.querySelector('time')?.getAttribute('datetime') ||
                           document.querySelector('[property="article:published_time"]')?.getAttribute('content') ||
                           document.querySelector('.date')?.textContent?.trim() ||
                           undefined;

        // Extract description
        const description = document.querySelector('[property="og:description"]')?.getAttribute('content') ||
                           document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                           undefined;

        // Extract main image
        const imageUrl = document.querySelector('[property="og:image"]')?.getAttribute('content') ||
                        document.querySelector('img')?.getAttribute('src') ||
                        undefined;

        return {
            title,
            content: fullContent.substring(0, 5000), // Limit content length
            author,
            publishDate,
            description,
            imageUrl,
            url
        };

    } catch (error) {
        throw new Error(`Failed to scrape blog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}; 