const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

const IPC_DIR = join(process.cwd(), 'tmp_widgets');
if (!existsSync(IPC_DIR)) mkdirSync(IPC_DIR, { recursive: true });

function updateMocks() {
  // Sysinfo
  writeFileSync(join(IPC_DIR, 'sysinfo.json'), JSON.stringify({
    cpu: Math.floor(Math.random() * 30 + 10),
    ram: Math.floor(Math.random() * 20 + 40),
    temp: 45.5,
    disk: 65,
    uptime: process.uptime()
  }));

  // Weather
  const weatherOptions = ['clear-day', 'cloudy', 'rain', 'partly-cloudy-day'];
  const icon = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
  writeFileSync(join(IPC_DIR, 'weather.json'), JSON.stringify({
    temp: Math.floor(Math.random() * 10 + 20),
    feels_like: 25,
    humidity: Math.floor(Math.random() * 20 + 50),
    wind_speed: Math.floor(Math.random() * 10),
    icon: icon,
    description: "Mock Data"
  }));
}

console.log("Starting mock daemons for Sysinfo and Weather...");
updateMocks();
setInterval(updateMocks, 2000);
