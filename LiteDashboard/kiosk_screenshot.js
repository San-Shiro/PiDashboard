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
      errors.push(msg.text() + ' ' + (msg.location() ? msg.location().url : ''));
      console.log('Browser Error:', msg.text(), msg.location() ? msg.location().url : '');
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
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 30000 });
    
    // Wait for widgets to initialize
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:/Users/Ketan/.gemini/antigravity/brain/571c0b5c-9711-4bb1-b758-67a729bd329f/kiosk_screenshot.png' });
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
