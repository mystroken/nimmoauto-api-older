import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
dotenv.config();

const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME as string;
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD as string;

// Utility to download images to a temp folder
async function downloadImages(imageUrls: string[]): Promise<string[]> {
  const tempDir = path.join(__dirname, '../../temp_images');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  const filePaths: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const filePath = path.join(tempDir, `img_${Date.now()}_${i}.jpg`);
    const response = await axios({ url, responseType: 'stream', method: 'GET' });
    await new Promise((resolve, reject) => {
      const stream = response.data.pipe(fs.createWriteStream(filePath));
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    filePaths.push(filePath);
  }
  return filePaths;
}

export const postToMeta = async (req: Request, res: Response) => {
  const { imageUrls, caption } = req.body;
  if (!Array.isArray(imageUrls) || !caption) {
    return res.status(400).json({ error: 'imageUrls (array) and caption (string) are required.' });
  }
  if (!INSTAGRAM_USERNAME || !INSTAGRAM_PASSWORD) {
    return res.status(500).json({ error: 'Instagram credentials are not set in .env' });
  }
  let browser: puppeteer.Browser | undefined;
  let imagePaths: string[] = [];
  try {
    imagePaths = await downloadImages(imageUrls);
    browser = await puppeteer.launch({ 
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-notifications',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
      ],
    });
    const page = await browser.newPage();
    // 1. Go to Meta Business Suite login page
    await page.goto('https://business.facebook.com/business/loginpage/?next=https%3A%2F%2Fbusiness.facebook.com%2F%3Fnav_ref%3Dbiz_unified_f3_login_page_to_mbs&login_options%5B0%5D=FB&login_options%5B1%5D=IG&login_options%5B2%5D=SSO&config_ref=biz_login_tool_flavor_mbs', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(1200);

    // 2. Try to find and click "Log in with Instagram" (robust, with debug)
    let igButton = null;
    for (let i = 0; i < 18; i++) { // 18 * 5s = 90s
      [igButton] = await page.$x("//*[contains(text(), 'Log in with Instagram')]");
      if (igButton) break;
      await page.waitForTimeout(5000);
    }

    let loginPage = page;
    let mainPage = page; // Save reference to the initial tab
    if (igButton) {
      await igButton.evaluate(el => (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await page.waitForTimeout(400);
      const box = await igButton.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
        await page.waitForTimeout(200);
      }
      console.log('Clicking Log in with Instagram button');
      // Listen for new page (popup/tab)
      const [newPage] = await Promise.all([
        new Promise(resolve => (browser as puppeteer.Browser).once('targetcreated', async (target: puppeteer.Target) => {
          const p = await target.page();
          if (p) await p.bringToFront();
          resolve(p);
        })),
        (igButton as puppeteer.ElementHandle<Element>).click(),
      ]);
      if (newPage) {
        loginPage = newPage as puppeteer.Page;
        // Wait for navigation or close
        try {
          await loginPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        } catch (e) {
          // Navigation might not happen if popup closes quickly
        }
        // If the popup is closed, switch back to the main page
        if (loginPage.isClosed()) {
          // Wait a bit for the dashboard to appear
          await new Promise(res => setTimeout(res, 2000));
          let dashboardPage;
          for (let i = 0; i < 10; i++) { // Try for up to 10 seconds
            const pages = await browser.pages();
            dashboardPage = undefined;
            for (const p of pages) {
              const title = await p.title();
              if (
                p.url().includes('business.facebook.com') ||
                title.toLowerCase().includes('meta business suite')
              ) {
                dashboardPage = p;
                break;
              }
            }
            if (dashboardPage) break;
            await new Promise(res => setTimeout(res, 1000));
          }
          if (!dashboardPage) {
            // Save debug info
            const pages = await browser.pages();
            for (let i = 0; i < pages.length; i++) {
              await pages[i].screenshot({ path: `dashboard_debug_${i}.png` });
              const html = await pages[i].content();
              fs.writeFileSync(`dashboard_debug_${i}.html`, html);
            }
            throw new Error('Could not find the dashboard page after Instagram login. Debug info saved.');
          }
          loginPage = dashboardPage;
        }
      } else {
        await page.screenshot({ path: 'login_debug.png' });
        const html = await page.content();
        fs.writeFileSync('login_debug.html', html);
        throw new Error('Could not find "Log in with Instagram" button. Screenshot and HTML saved for debugging.');
      }
    }
    // Now check if mainPage is still open
    if (mainPage.isClosed()) {
      throw new Error('Main page was closed unexpectedly.');
    }
    // Use mainPage for all further actions
    // 3. Instagram login form (on loginPage)
    try {
      await loginPage.waitForSelector('input[name="username"]', { timeout: 60000 });
      await loginPage.waitForTimeout(400);
      await loginPage.focus('input[name="username"]');
      for (const char of INSTAGRAM_USERNAME) {
        await loginPage.keyboard.type(char, { delay: 120 });
      }
      await loginPage.waitForTimeout(600);
      await loginPage.focus('input[name="password"]');
      for (const char of INSTAGRAM_PASSWORD) {
        await loginPage.keyboard.type(char, { delay: 120 });
      }
      await loginPage.waitForTimeout(600);
      await loginPage.click('button[type="submit"]');
      console.log('Clicked Instagram login submit button');
      // After clicking the Instagram login button, handle 'Save Info' if it appears
      try {
        await loginPage.waitForXPath("//*[contains(text(), 'Save Info')]", { timeout: 30000 });
        const [saveInfoBtn] = await loginPage.$x("//*[contains(text(), 'Save Info')]");
        if (saveInfoBtn) {
          await saveInfoBtn.evaluate(el => (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }));
          await loginPage.waitForTimeout(400);
          await (saveInfoBtn as puppeteer.ElementHandle<Element>).click();
          console.log('Clicked Save Info button');
          await loginPage.waitForTimeout(1000);
        }
        // Add a wait after clicking Save Info before searching for 'Créer une publication'
        await loginPage.waitForTimeout(40000);
      } catch (e) {
        // If not found, just continue
      }
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
        await loginPage.waitForTimeout(400);
        const box = await saveInfoButton.boundingBox();
        if (box) {
          await loginPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
          await loginPage.waitForTimeout(200);
        }
        await (saveInfoButton as puppeteer.ElementHandle<Element>).click();
        console.log('Clicked Save info (prompt) button');
        await loginPage.waitForTimeout(100000); // Wait 10 seconds for dashboard to load
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
      await loginPage.waitForSelector('button:has-text("Yes, continue")', { timeout: 150000 });
      await loginPage.click('button:has-text("Yes, continue")');
      console.log('Clicked Yes, continue button');
    } catch (e) {
      // If not shown, continue
    }

    // Wait for and click the "Créer une publication" button
    try {
      await mainPage.evaluate(() => window.scrollTo(0, 0));
      await mainPage.waitForXPath("//*[contains(translate(normalize-space(text()), 'É', 'E'), 'publication')]");
      const [createPostBtn] = await mainPage.$x("//*[contains(translate(normalize-space(text()), 'É', 'E'), 'publication')]");
      if (createPostBtn) {
        await createPostBtn.evaluate(el => (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await mainPage.waitForTimeout(400);
        await (createPostBtn as puppeteer.ElementHandle<Element>).click();
        console.log('Clicked Créer une publication button');
        await mainPage.waitForTimeout(20000); // Wait 20 seconds for the post dialog to fully load
      } else {
        await mainPage.screenshot({ path: 'creer_publication_debug.png' });
        const html = await mainPage.content();
        fs.writeFileSync('creer_publication_debug.html', html);
        throw new Error('Could not find "Créer une publication" button. Screenshot and HTML saved for debugging.');
      }
    } catch (e) {
      await mainPage.screenshot({ path: 'creer_publication_debug.png' });
      const html = await mainPage.content();
      fs.writeFileSync('creer_publication_debug.html', html);
      throw new Error('Failed to find or click "Créer une publication" button. Screenshot and HTML saved for debugging.');
    }
    // Click 'Ajouter une photo/vidéo' div button before uploading images
    try {
      // Find the div by text
      const [ajouterBtn] = await mainPage.$x("//div[contains(text(), 'Ajouter une photo/vidéo')]");
      if (!ajouterBtn) {
        await mainPage.screenshot({ path: 'ajouter_photo_btn_debug.png' });
        throw new Error('Could not find "Ajouter une photo/vidéo" div button.');
      }
      await (ajouterBtn as puppeteer.ElementHandle<Element>).hover();
      await mainPage.waitForTimeout(200);
      const box = await (ajouterBtn as puppeteer.ElementHandle<Element>).boundingBox();
      if (box) {
        await mainPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await mainPage.mouse.down();
        await mainPage.mouse.up();
        console.log('Clicked Ajouter une photo/vidéo button with mouse API');
        await mainPage.waitForTimeout(1000);
      } else {
        await (ajouterBtn as puppeteer.ElementHandle<Element>).click({ delay: 100 });
        console.log('Clicked Ajouter une photo/vidéo button with DOM click');
        await mainPage.waitForTimeout(1000);
      }
      // Add a wait time after clicking before looking for file input
      await mainPage.waitForTimeout(9000);
      // Wait for the file input(s) to appear (including hidden ones)
      const fileInputs = await mainPage.$$('input[type="file"]');
      if (!fileInputs || fileInputs.length === 0) {
        await mainPage.screenshot({ path: 'file_input_debug.png' });
        throw new Error('No file input found after clicking "Ajouter une photo/vidéo".');
      }
      // Download images to temp files (like postBot)
      const tempPaths: string[] = [];
      for (const url of imageUrls) {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const ext = path.extname(url) || '.jpg';
        const tempPath = path.join(__dirname, `temp_upload_${Date.now()}${ext}`);
        fs.writeFileSync(tempPath, response.data);
        tempPaths.push(tempPath);
      }
      let uploadSuccess = false;
      for (const input of fileInputs) {
        try {
          // Make input and up to 3 parents visible and interactable
          await mainPage.evaluate(el => {
            let elem = el as HTMLElement;
            for (let i = 0; i < 4 && elem; i++) {
              elem.removeAttribute('style');
              elem.style.display = 'block';
              elem.style.visibility = 'visible';
              elem.style.opacity = '1';
              elem.style.position = 'static';
              elem.style.pointerEvents = 'auto';
              elem.style.zIndex = '9999';
              elem.style.width = '200px';
              elem.style.height = '50px';
              elem = elem.parentElement as HTMLElement;
            }
          }, input);
          await (input as puppeteer.ElementHandle<HTMLInputElement>).uploadFile(...tempPaths);
          console.log('Images uploaded to a file input (including hidden and parent styles fixed)');
          uploadSuccess = true;
          await mainPage.waitForTimeout(2000);
          break;
        } catch (e) {
          console.log('Failed to upload to one file input, trying next...');
        }
      }
      // Clean up temp files
      for (const tempPath of tempPaths) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      if (!uploadSuccess) {
        throw new Error('Could not upload images to any file input.');
      }
    } catch (e) {
      await mainPage.screenshot({ path: 'file_upload_step_debug.png' });
      const html = await mainPage.content();
      fs.writeFileSync('file_upload_step_debug.html', html);
      throw new Error('Could not complete file upload step. Screenshot and HTML saved for debugging.');
    }

    // Add caption
    await page.waitForSelector('textarea', { timeout: 10000 });
    await page.type('textarea', caption, { delay: 50 });

    // Click Post
    await page.waitForSelector('button:has-text("Post")', { timeout: 10000 });
    await page.click('button:has-text("Post")');
    console.log('Clicked Post button');

    res.json({ success: true, message: 'Post created successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
    // Clean up temp images
    for (const img of imagePaths) {
      if (fs.existsSync(img)) fs.unlinkSync(img);
    }
  }
};
