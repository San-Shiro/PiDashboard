const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('response', response => {
    if (response.status() === 404) {
      console.log('404 Not Found:', response.url());
    }
  });

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
    process.exit(0);
  } catch (err) {
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
