const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/crypto-test.json', 'utf8')).inst1;
const fragment = fs.readFileSync('widgets/crypto-desk/fragment/crypto.html', 'utf8');

const html = `
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="background: #000; padding: 20px;">
  <div style="width: 400px; height: 250px;">
    ${fragment}
  </div>
  <script>
    // Mock the PiWidget SDK
    window.widget = {
      config: {
        coins: "bitcoin,ethereum",
        currency: "usd",
        themeColor: "#10b981",
        backgroundColor: "#0f172a"
      },
      register: function(opts) {
        window.instanceId = 'inst1';
        opts.onState(${JSON.stringify({ inst1: data })});
      }
    };
  </script>
</body>
</html>
`;

fs.writeFileSync('scripts/test_crypto.html', html);

const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/scripts/test_crypto.html');
  await new Promise(r => setTimeout(r, 500)); // wait for font to load
  await page.screenshot({path: 'scripts/crypto_screenshot.png'});
  await browser.close();
  console.log('Screenshot saved to scripts/crypto_screenshot.png');
})();
