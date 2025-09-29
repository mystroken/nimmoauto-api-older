import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Page, ElementHandle } from 'puppeteer';
import { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Initialize with stealth plugin
puppeteer.use(StealthPlugin());

interface FacebookCredentials {
  email: string;
  password: string;
}

interface StoryPost {
  imageUrl: string;
  caption?: string;
}

// Helper to download image to a temp file
async function downloadImageToTemp(url: string): Promise<string> {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const ext = path.extname(url) || '.jpg';
  const tempPath = path.join(__dirname, `temp_upload_${Date.now()}${ext}`);
  fs.writeFileSync(tempPath, response.data);
  return tempPath;
}

class FacebookStoryPoster {
  private readonly loginUrl = 'https://www.facebook.com/login';
  private readonly homeUrl = 'https://www.facebook.com';

  async postStory(credentials: FacebookCredentials, post: StoryPost): Promise<{ success: boolean; message?: string }> {
    // Validate input
    if (!credentials.email || !credentials.password) {
      return { success: false, message: 'Email and password are required' };
    }

    if (!post.imageUrl) {
      return { success: false, message: 'Image URL is required' };
    }

    let browser;
    try {
      // Launch browser with human-like settings
      browser = await puppeteer.launch({
        headless: true, // Use headless mode for server compatibility
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
          `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.getRandomChromeVersion()} Safari/537.36`,
        ],
        defaultViewport: {
          width: this.getRandomViewportSize(1280, 100),
          height: this.getRandomViewportSize(800, 100),
        },
      });

      const page = await browser.newPage();

      // Randomize mouse movements and other human-like behaviors
      await this.enableHumanSimulation(page);

      // Navigate to Facebook with random delays
      await this.navigateWithDelay(page, this.loginUrl, 2000, 5000);

      // Login with human-like behavior
      await this.humanLogin(page, credentials);

      // Wait for navigation or a short timeout (in case no navigation)
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
      } catch (e) {
        // Ignore timeout, as sometimes Facebook doesn't navigate
      }

      // Detect 2FA or checkpoint and wait for user confirmation
      const url = page.url();
      if (
        url.includes('checkpoint') ||
        (await page.$('input[name="approvals_code"]')) ||
        (await page.$('button[type="submit"]'))
      ) {
        console.log('2FA or checkpoint detected. Please complete verification in the browser, then press ENTER to continue...');
        await new Promise(resolve => process.stdin.once('data', resolve));
      }

      // Verify login success
      if (!(await this.isLoggedIn(page))) {
        throw new Error('Login failed - check your credentials');
      }

      // After login, go directly to the story creation page
      await this.navigateWithDelay(page, 'https://www.facebook.com/stories/create', 2000, 4000);

      // Post story with human-like behavior
      await this.postHumanStory(page, post);

      // Post to Page feed with human-like behavior
      let pageFeedResult = 'Not attempted';
      try {
        pageFeedResult = await this.postHumanPageFeed(page, post);
      } catch (e) {
        pageFeedResult = `Error: ${(e instanceof Error ? e.message : String(e))}`;
      }

      // Add some random browsing before closing
      await this.simulateRandomActivity(page);

      return { success: true, message: `Story posted successfully. Page feed post: ${pageFeedResult}` };
    } catch (error) {
      console.error('Error posting story:', error);
      let message = 'Unknown error';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        message = (error as any).message;
      }
      return { success: false, message };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async enableHumanSimulation(page: Page) {
    // Randomize mouse movements
    await page.setUserAgent(
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.getRandomChromeVersion()} Safari/537.36`
    );

    // Randomize timezone and geolocation
    await page.emulateTimezone('Africa/Douala');
    await page.setGeolocation({ latitude: 5.954250, longitude: 10.140156 });

    // Enable request interception to block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const blockResources = [ 'font']; // Do NOT block 'stylesheet'
      if (blockResources.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  private async navigateWithDelay(page: Page, url: string, minDelay: number, maxDelay: number) {
    await this.delay(this.random(minDelay, maxDelay));
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await this.delay(this.random(1000, 3000)); // Wait after navigation
  }

  private async humanLogin(page: Page, credentials: FacebookCredentials) {
    // Type email with human-like delays
    await page.waitForSelector('#email', { timeout: 5000 });
    await this.typeHumanly(page, '#email', credentials.email);
    await this.delay(this.random(500, 1500));

    // Type password with human-like delays
    await page.waitForSelector('#pass', { timeout: 5000 });
    await this.typeHumanly(page, '#pass', credentials.password);
    await this.delay(this.random(500, 1500));

    // Random mouse movement before clicking
    await this.moveMouseHumanly(page, '#loginbutton');

    // Click login button
    await page.click('#loginbutton');
    await this.delay(this.random(2000, 5000)); // Wait for login to complete
  }

  private async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector('[aria-label="Facebook"]', { timeout: 10000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async postHumanStory(page: Page, post: StoryPost) {
    // Step 2: Click "Créer une story avec photos" card (robust French text match)
    let found = false;
    // Wait for up to 10s for the card to appear (XPath, partial match)
    try {
      await page.waitForXPath("//*[contains(text(), 'Créer une story avec photos')]", { timeout: 10000 });
    } catch {}
    // Try all clickable cards/buttons for exact or partial match
    const centerCards = await page.$$('div[role="button"], div[tabindex="0"]');
    for (const card of centerCards) {
      const text = await page.evaluate(el => (el as HTMLElement).innerText.trim(), card);
      if (text === 'Créer une story avec photos' || text.includes('Créer une story avec photos')) {
        await page.evaluate(el => (el as HTMLElement).scrollIntoView({behavior: 'smooth', block: 'center'}), card);
        await this.delay(this.random(300, 800));
        await (card as ElementHandle<Element>).click();
        found = true;
        break;
      }
    }
    // Fallback: Try XPath for any element containing the text
    if (!found) {
      const [el] = await page.$x("//*[contains(text(), 'Créer une story avec photos')]");
      if (el) {
        await page.evaluate(el => (el as HTMLElement).scrollIntoView({behavior: 'smooth', block: 'center'}), el);
        await this.delay(this.random(300, 800));
        await (el as ElementHandle<Element>).click();
        found = true;
      }
    }
    if (!found) {
      await page.screenshot({ path: 'debug_creer_story_avec_photos.png' });
      throw new Error('Could not find the "Créer une story avec photos" card. Screenshot saved as debug_creer_story_avec_photos.png. Please update the selector.');
    }
    await this.delay(this.random(1000, 2000));

    // Step 3: Wait for file input and upload image
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
    if (fileInput) {
      const localImagePath = await downloadImageToTemp(post.imageUrl);
      await (fileInput as ElementHandle<HTMLInputElement>).uploadFile(localImagePath);
      await this.delay(this.random(2000, 5000)); // Wait for upload to complete
      try { fs.unlinkSync(localImagePath); } catch {}
    } else {
      throw new Error('Could not find file input after clicking "Créer une story avec photos".');
    }

    // Step 4: Click "Ajouter du texte" before typing the caption (exact text match)
    if (post.caption) {
      let foundTextBtn = false;
      const addTextBtns = await page.$$('a, button, div[role="button"], div[tabindex="0"]');
      for (const btn of addTextBtns) {
        const text = await page.evaluate(el => (el as HTMLElement).innerText.trim(), btn);
        if (text === 'Ajouter du texte') {
          await (btn as ElementHandle<Element>).click();
          foundTextBtn = true;
          break;
        }
      }
      if (!foundTextBtn) {
        throw new Error('Could not find the "Ajouter du texte" button. Please update the selector.');
      }
      await this.delay(this.random(500, 1500));

      // Step 5: Type the caption (find the active textbox)
      let foundSelector = null;
      const captionSelectors = [
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        'textarea',
      ];
      for (const selector of captionSelectors) {
        const el = await page.$(selector);
        if (el) {
          foundSelector = selector;
          break;
        }
      }
      if (!foundSelector) {
        // Try XPath for any contenteditable div
        const [el] = await page.$x("//div[@contenteditable='true']");
        if (el) {
          foundSelector = 'div[contenteditable="true"]';
        }
      }
      if (!foundSelector) {
        throw new Error('Could not find the caption input field. Please update the selector.');
      }
      await this.typeHumanly(page, foundSelector, post.caption);
      await this.delay(this.random(1000, 2000));
    }

    // Step 6: Click "Partager dans une story" (blue button, exact text match)
    // Scroll main content and preview panel to bottom to reveal the button
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      // Try to scroll any story preview panel as well
      const preview = document.querySelector('div[role="main"]') || document.querySelector('main');
      if (preview) (preview as HTMLElement).scrollTop = (preview as HTMLElement).scrollHeight;
    });
    // Wait up to 15s for the button to appear
    found = false;
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('a, button, div[role="button"], div[tabindex="0"]'));
        return btns.some(el => (el as HTMLElement).innerText && (el as HTMLElement).innerText.trim() === 'Partager dans une story');
      }, { timeout: 15000 });
    } catch {}
    const shareBtns = await page.$$('a, button, div[role="button"], div[tabindex="0"]');
    for (const btn of shareBtns) {
      const text = await page.evaluate(el => (el as HTMLElement).innerText.trim(), btn);
      if (text === 'Partager dans une story') {
        await this.moveMouseHumanly(page, btn);
        await this.delay(this.random(500, 1500));
        await (btn as ElementHandle<Element>).click();
        found = true;
        break;
      }
    }
    if (!found) {
      await page.screenshot({ path: 'debug_partager_story.png' });
      throw new Error('Could not find the "Partager dans une story" button. Screenshot saved as debug_partager_story.png. Please update the selector.');
    }
    await this.delay(this.random(3000, 6000)); // Wait for post to complete
  }

  // Simulate posting to the Facebook Page feed as a human
  private async postHumanPageFeed(page: Page, post: StoryPost): Promise<string> {
    // You must set your Facebook Page URL in the environment variable FB_PAGE_URL
    const pageUrl = process.env.FB_PAGE_URL;
    if (!pageUrl) {
      throw new Error('FB_PAGE_URL environment variable is not set');
    }
    // Navigate to the Page
    await this.navigateWithDelay(page, pageUrl, 2000, 5000);
    // Click on the "Create post" button
    const createPostSelector = '[aria-label="Create a post"]';
    await this.moveMouseHumanly(page, createPostSelector);
    await this.delay(this.random(500, 1500));
    await page.click(createPostSelector);
    await this.delay(this.random(1000, 3000));
    // Upload the image
    const addPhotoSelectors = [
      'div[aria-label="Photo/video"]',
      'div[aria-label="Ajouter une photo/vidéo"]',
      'div[aria-label="Ajouter une photo ou une vidéo"]',
      'div[aria-label="Photo"]',
      'div[aria-label="Vidéo"]',
      'div[role="button"][tabindex="0"]',
    ];
    let clicked = false;
    for (const selector of addPhotoSelectors) {
      const el = await page.$(selector);
      if (el) {
        await (el as ElementHandle<Element>).click();
        clicked = true;
        break;
      }
    }
    // Try XPath for partial text matches if not found
    if (!clicked) {
      const xpaths = [
        "//div[contains(text(), 'photo')]",
        "//div[contains(text(), 'Photo')]",
        "//div[contains(text(), 'vidéo')]",
        "//div[contains(text(), 'Vidéo')]",
        "//span[contains(text(), 'photo')]",
        "//span[contains(text(), 'Photo')]",
        "//span[contains(text(), 'vidéo')]",
        "//span[contains(text(), 'Vidéo')]",
      ];
      for (const xpath of xpaths) {
        const [el] = await page.$x(xpath);
        if (el) {
          await (el as ElementHandle<Element>).click();
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) {
      throw new Error('Could not find the "Add photo/video" button. Please update the selector.');
    }
    // Wait for a file input to appear and upload the file
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      const localImagePath = await downloadImageToTemp(post.imageUrl);
      await (fileInput as ElementHandle<HTMLInputElement>).uploadFile(localImagePath);
      await this.delay(this.random(2000, 5000)); // Wait for upload
      try { fs.unlinkSync(localImagePath); } catch {}
    } else {
      throw new Error('Could not find file input after clicking "Add photo/video".');
    }
    // Add caption
    if (post.caption) {
      await this.typeHumanly(page, 'div[aria-label="Write something..."]', post.caption);
      await this.delay(this.random(1000, 2000));
    }
    // Click the "Post" button
    const postButtonSelector = 'div[aria-label="Post"]';
    await this.moveMouseHumanly(page, postButtonSelector);
    await this.delay(this.random(500, 1500));
    await page.click(postButtonSelector);
    await this.delay(this.random(3000, 6000)); // Wait for post
    return 'Page feed post attempted';
  }

  private async simulateRandomActivity(page: Page) {
    // Scroll randomly
    await page.evaluate(async () => {
      const scrollAmount = Math.floor(Math.random() * 1000) + 500;
      window.scrollBy(0, scrollAmount);
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000 + 1000));
    });

    // Randomly click on some elements
    const elements = await page.$$('a, button');
    if (elements.length > 0) {
      const randomElement = elements[Math.floor(Math.random() * elements.length)];
      await this.moveMouseHumanly(page, randomElement);
      await this.delay(this.random(500, 1500));
      await randomElement.click();
      await this.delay(this.random(2000, 4000));
    }
  }

  private async moveMouseHumanly(page: Page, selector: string | ElementHandle) {
    const element = typeof selector === 'string' ? await page.$(selector) : selector;
    if (!element) return;

    const box = await element.boundingBox();
    if (!box) return;

    // Move mouse in a slightly curved path to the element
    const steps = this.random(3, 8);
    for (let i = 0; i < steps; i++) {
      const x = box.x + (box.width * i) / steps + this.random(-10, 10);
      const y = box.y + (box.height * i) / steps + this.random(-10, 10);
      await page.mouse.move(x, y, { steps: 1 });
      await this.delay(this.random(50, 200));
    }
  }

  private async typeHumanly(page: Page, selector: string, text: string) {
    await page.click(selector);
    await this.delay(this.random(200, 500));

    for (const char of text) {
      await page.keyboard.type(char, { delay: this.random(30, 150) });
      if (Math.random() > 0.8) {
        await this.delay(this.random(100, 500)); // Random pauses while typing
      }
    }
  }

  // Helper methods
  private random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRandomViewportSize(base: number, variation: number): number {
    return base + this.random(-variation, variation);
  }

  private getRandomChromeVersion(): string {
    const versions = [
      '91.0.4472.124',
      '92.0.4515.107',
      '93.0.4577.63',
      '94.0.4606.61',
      '95.0.4638.54',
      '96.0.4664.45',
      '97.0.4692.71',
      '98.0.4758.102',
    ];
    return versions[this.random(0, versions.length - 1)];
  }
}

// Export the class for use in other files
export default FacebookStoryPoster;

// Export an Express handler for posting a Facebook story via bot
export const postFacebookStoryBot = async (req: Request, res: Response) => {
  const { imageUrl, caption } = req.body;
  const email = process.env.FB_BOT_EMAIL;
  const password = process.env.FB_BOT_PASSWORD;
  if (!email || !password) {
    return res.status(500).json({ success: false, message: 'Bot email and password must be set in environment variables (FB_BOT_EMAIL, FB_BOT_PASSWORD)' });
  }
  if (!imageUrl) {
    return res.status(400).json({ success: false, message: 'imageUrl is required' });
  }
  const poster = new FacebookStoryPoster();
  const result = await poster.postStory({ email, password }, { imageUrl, caption });
  if (result.success) {
    return res.json({ success: true, message: result.message });
  } else {
    return res.status(500).json({ success: false, message: result.message });
  }
};