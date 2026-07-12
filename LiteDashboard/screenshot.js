const puppeteer = require('puppeteer');

(async () => {
  console.log('Performing setup check...');
  try {
    const res = await fetch('http://localhost:3000/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test1234' })
    });
    console.log('Setup response status:', res.status);
  } catch (e) {
    console.log('Setup check failed:', e.message);
  }

  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  // Track errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('Browser Error:', msg.text());
    } else {
      console.log('Browser Log:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('Browser Exception:', error.message);
  });

  try {
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3000/admin/canvas/bingo-1780147342871/edit', { waitUntil: 'load', timeout: 30000 });

    console.log('Waiting for login or editor to load...');
    const isLogin = await Promise.race([
      page.waitForSelector('input[type="password"]', { timeout: 5000 }).then(() => true),
      page.waitForSelector('.absolute.inset-0.pointer-events-none', { timeout: 5000 }).then(() => false)
    ]).catch(() => false);

    if (isLogin) {
      console.log('Logging in...');
      await page.type('input[type="password"]', 'test1234');
      await page.click('button');
      console.log('Waiting for redirect...');
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
      console.log('Navigating back to canvas editor...');
      await page.goto('http://localhost:3000/admin/canvas/bingo-1780147342871/edit', { waitUntil: 'load', timeout: 30000 });
      console.log('Waiting for editor to load...');
      await page.waitForSelector('.absolute.inset-0.pointer-events-none', { timeout: 10000 }).catch(() => {});
    }
    
    // Wait for widgets to initialize
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:/Users/Ketan/.gemini/antigravity/brain/571c0b5c-9711-4bb1-b758-67a729bd329f/screenshot.png' });
    console.log('Screenshot saved to artifacts.');
    
    if (errors.length > 0) {
      console.error('Test completed with', errors.length, 'errors.');
      process.exit(1);
    } else {
      console.log('Test completed successfully with no errors!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Puppeteer navigation failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
