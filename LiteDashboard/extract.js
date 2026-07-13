const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await page.type('input[type="password"]', 'test1234');
  await page.click('button');
  await new Promise(r => setTimeout(r, 2000));
  
  await page.goto('http://localhost:3000/admin/canvas/bingo-1780147342871/edit', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));
  
  // Find all iframes
  for (const frame of page.frames()) {
    const text = await frame.evaluate(() => {
      return document.body ? document.body.innerHTML : null;
    });
    if (text) {
      console.log('--- FRAME TEXT ---');
      console.log(text);
    }
  }
  
  await browser.close();
})();
