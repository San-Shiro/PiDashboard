const fs = require('fs');
const b64 = fs.readFileSync('widgets/community-earthquakes/fragment/map.b64', 'utf8').trim().replace(/^data:image\/png;base64,/, '');
const html = `<html>
<body style='background: black;'>
  <div style='width: 800px; height: 400px; position: relative;'>
    <div style='position: absolute; width: 100%; height: 100%; z-index: 1; pointer-events: none; overflow: hidden;'>
      <img class='world-map' src='data:image/png;base64,${b64}' style='width: 100%; height: 100%; object-fit: contain; opacity: 0.6; transform: translateX(-100vw); filter: drop-shadow(100vw 0 0 #ff0000);' />
    </div>
  </div>
</body>
</html>`;
fs.writeFileSync('scripts/test_shadow.html', html);
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/scripts/test_shadow.html');
  await page.screenshot({path: 'scripts/test_shadow_screenshot.png'});
  await browser.close();
  console.log('Screenshot saved');
})();
