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
    page.on('request', req => {
      if (req.url().includes('/api/logs')) {
        console.log('API LOGS POST:', req.postData());
      }
    });
    page.on('response', res => {
      if (res.status() !== 200 && res.status() !== 101) {
        console.log('Response Error:', res.status(), res.url());
      }
    });
    
    console.log('Navigating to kiosk...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
    
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
    
    // Dump the main HTML plus iframe HTMLs
    const html = await page.evaluate(() => {
      let out = '=== MAIN DOM ===\n' + document.body.outerHTML + '\n';
      const iframes = document.querySelectorAll('iframe');
      for (let i = 0; i < iframes.length; i++) {
        out += '\n=== IFRAME ' + i + ' ===\n';
        try {
          out += iframes[i].contentDocument.body.outerHTML;
        } catch(e) {
          out += 'Error: ' + e.message;
        }
      }
      return out;
    });
    console.log(html);
    
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
