import { Request, Response } from 'express';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const INSTAGRAM_USERNAME = process.env.IG_USERNAME!;
const INSTAGRAM_PASSWORD = process.env.IG_PASSWORD!;

function randomDelay(min = 100, max = 400) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function startBrowser(res?: Response) {
  try {
    const browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      defaultViewport: null,
      args: ['--no-sandbox',
        '--disable-notifications',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
          `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Add listeners to auto-restart if the session closes unexpectedly
    browser.on('disconnected', () => {
      console.log('Warning: Puppeteer browser was disconnected! Restarting...');
      startBrowser();
    });
    page.on('close', () => {
      console.log('Warning: Puppeteer page was closed! Restarting...');
      startBrowser();
    });

    // 1. Go to Meta Business Suite login page
    await page.goto('https://business.facebook.com/business/loginpage/?next=https%3A%2F%2Fbusiness.facebook.com%2F%3Fnav_ref%3Dbiz_unified_f3_login_page_to_mbs&login_options%5B0%5D=FB&login_options%5B1%5D=IG&login_options%5B2%5D=SSO&config_ref=biz_login_tool_flavor_mbs', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(randomDelay(800, 1800));

    // 2. Try to find and click "Log in with Instagram" (robust, with debug)
    let igButton = null;
    for (let i = 0; i < 18; i++) { // 18 * 5s = 90s
      [igButton] = await page.$x("//*[contains(text(), 'Log in with Instagram')]");
      if (igButton) break;
      await page.waitForTimeout(5000);
    }

    let loginPage = page;
    if (igButton) {
      await igButton.evaluate(el => (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await page.waitForTimeout(randomDelay(200, 600));
      const box = await igButton.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
        await page.waitForTimeout(randomDelay(100, 400));
      }
      if (Math.random() < 0.2) await page.waitForTimeout(randomDelay(1000, 2500));
      // Listen for new page (popup/tab)
      const [newPage] = await Promise.all([
        new Promise(resolve => browser.once('targetcreated', async target => {
          const p = await target.page();
          if (p) await p.bringToFront();
          resolve(p);
        })),
        (igButton as puppeteer.ElementHandle<Element>).click(),
      ]);
      if (newPage) {
        loginPage = newPage as puppeteer.Page;
      }
    } else {
      await page.screenshot({ path: 'login_debug.png' });
      const html = await page.content();
      fs.writeFileSync('login_debug.html', html);
      throw new Error('Could not find "Log in with Instagram" button. Screenshot and HTML saved for debugging.');
    }

    // 3. Instagram login form (on loginPage)
    try {
      await loginPage.waitForSelector('input[name="username"]', { timeout: 60000 });
      await loginPage.waitForTimeout(randomDelay(200, 600));
      await loginPage.focus('input[name="username"]');
      for (const char of INSTAGRAM_USERNAME) {
        await loginPage.keyboard.type(char, { delay: randomDelay(80, 180) });
      }
      await loginPage.waitForTimeout(randomDelay(300, 900));
      await loginPage.focus('input[name="password"]');
      for (const char of INSTAGRAM_PASSWORD) {
        await loginPage.keyboard.type(char, { delay: randomDelay(80, 180) });
      }
      await loginPage.waitForTimeout(randomDelay(300, 900));
      if (Math.random() < 0.2) await loginPage.waitForTimeout(randomDelay(1000, 2500));
      await loginPage.click('button[type="submit"]');
    } catch (e) {
      await loginPage.screenshot({ path: 'login_form_debug.png' });
      const html = await loginPage.content();
      fs.writeFileSync('login_form_debug.html', html);
      throw new Error('Could not find Instagram login form. Screenshot and HTML saved for debugging.');
    }

    // 4. Handle "Save info" prompt (robust)
    try {
      let saveInfoButton = null;
      for (let i = 0; i < 6; i++) { // Try for up to 30 seconds
        [saveInfoButton] = await loginPage.$x("//*[contains(text(), 'Save info')]");
        if (saveInfoButton) break;
        await loginPage.waitForTimeout(5000);
      }
      if (saveInfoButton) {
        await saveInfoButton.evaluate(el => (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await loginPage.waitForTimeout(randomDelay(200, 600));
        const box = await saveInfoButton.boundingBox();
        if (box) {
          await loginPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
          await loginPage.waitForTimeout(randomDelay(100, 400));
        }
        if (Math.random() < 0.2) await loginPage.waitForTimeout(randomDelay(1000, 2500));
        await (saveInfoButton as puppeteer.ElementHandle<Element>).click();
      } else {
        await loginPage.screenshot({ path: 'save_info_debug.png' });
        const html = await loginPage.content();
        fs.writeFileSync('save_info_debug.html', html);
        console.log('Could not find "Save info" button. Screenshot and HTML saved for debugging.');
      }
    } catch (e) {
      // If not shown, continue
    }

    // 5. Handle "Login with Instagram" prompt
    try {
      await loginPage.waitForSelector('button:has-text("Yes, continue")', { timeout: 15000 });
      await loginPage.click('button:has-text("Yes, continue")');
    } catch (e) {
      // If not shown, continue
    }

    // 6. Wait for dashboard to load
    try {
      await loginPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }); // 2 minutes
    } catch (e) {
      console.log('Navigation timeout exceeded, continuing anyway...');
    }

    // Focus the page content to remove selection from the address bar
    await loginPage.evaluate(() => {
      (document.querySelector('body') as HTMLElement)?.focus();
    });
    await loginPage.waitForTimeout(randomDelay(400, 1200));

    // 7. Click "Créer une publication" (Create a post) - robust for unicode/encoding
    try {
      let createPostButton = null;
      for (let i = 0; i < 6; i++) { // Try for up to 30 seconds
        // Try both normal and unicode-escaped text
        [createPostButton] = await loginPage.$x("//*[contains(text(), 'Créer une publication') or contains(text(), '\u00e9er une publication')]");
        if (createPostButton) break;
        await loginPage.waitForTimeout(5000);
      }
      if (createPostButton) {
        await createPostButton.evaluate(el => (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await loginPage.waitForTimeout(randomDelay(200, 600));
        const box = await createPostButton.boundingBox();
        if (box) {
          await loginPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
          await loginPage.waitForTimeout(randomDelay(100, 400));
        }
        if (Math.random() < 0.2) await loginPage.waitForTimeout(randomDelay(1000, 2500));
        await (createPostButton as puppeteer.ElementHandle<Element>).click();
        console.log('Clicked "Créer une publication"');
      } else {
        await loginPage.screenshot({ path: 'create_post_debug.png' });
        const html = await loginPage.content();
        fs.writeFileSync('create_post_debug.html', html);
        throw new Error('Could not find "Créer une publication" button. Screenshot and HTML saved for debugging.');
      }
    } catch (e) {
      throw new Error('Error trying to click "Créer une publication": ' + (e as Error).message);
    }

    // Leave browser open for debugging
    if (res) {
      res.status(200).json({ success: true, message: 'Login flow completed. Browser is open for debugging.' });
    }
  } catch (error: any) {
    if (res) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      console.error('Fatal error in browser automation:', error);
    }
  }
}

export const loginToBusinessSuite = async (req: Request, res: Response) => {
  await startBrowser(res);
}; 