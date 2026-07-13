const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

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
    console.log('Navigating to kiosk...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
    
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
    
    await page.screenshot({ path: 'C:/Users/Ketan/.gemini/antigravity/brain/571c0b5c-9711-4bb1-b758-67a729bd329f/kiosk_screenshot4.png' });
    console.log('Screenshot saved.');
    
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
