const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: "new"
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Wait for a few seconds to let daemons populate data and animations to run
    await new Promise(r => setTimeout(r, 4000));
    
    // Take first screenshot
    await page.screenshot({ path: 'screenshot1.png' });
    
    // Wait for 2 more seconds
    await new Promise(r => setTimeout(r, 2000));
    
    // Take second screenshot
    await page.screenshot({ path: 'screenshot2.png' });
    
    await browser.close();
    console.log("Screenshots captured successfully.");
  } catch (err) {
    console.error("Puppeteer error:", err);
  }
})();
