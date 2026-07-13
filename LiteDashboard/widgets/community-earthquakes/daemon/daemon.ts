import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Daemon loop
async function run() {
  const ipcPath = process.env.PIDASH_IPC_FILE || join(process.cwd(), '../../../state/ipc/community-earthquakes.json');
  let nextFetch = Date.now();
  let cachedOutput: Record<string, any> = {};
  
  while (true) {
        try {
          const configStr = process.env.PIDASH_CONFIG || '{}';
          const config = JSON.parse(configStr);
          
          const instances = Object.keys(config).filter(k => k !== '_isInstances');
          
          
          if (instances.length > 0 && Date.now() >= nextFetch) {
            // Fetch global data once
            const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
            const data = await res.json();
            
            const newOutput: Record<string, any> = {};
            for (const inst of instances) {
              const instConfig = config[inst];
              const minMag = instConfig.minMagnitude || 3.0;
              
              // Filter and map
              const quakes = data.features
                .filter((f: any) => f.properties.mag >= minMag)
                .sort((a: any, b: any) => b.properties.time - a.properties.time)
                .slice(0, 15) // Keep top 15 to stay strictly under 10KB
                .map((f: any) => ({
                  id: f.id,
                  mag: f.properties.mag,
                  place: f.properties.place,
                  time: f.properties.time,
                  lng: f.geometry.coordinates[0],
                  lat: f.geometry.coordinates[1]
                }));
                
              newOutput[inst] = quakes;
            }
            cachedOutput = newOutput;
            
            console.log(`[Earthquakes Daemon] Updated ${instances.length} instances.`);
            nextFetch = Date.now() + 60000; // Fetch again in 60 seconds
          }
          
          // Write to IPC even if empty or using cached data (so we pass the 30s health check)
          const ipcDir = join(ipcPath, '..');
          if (!existsSync(ipcDir)) {
            mkdirSync(ipcDir, { recursive: true });
          }
          writeFileSync(ipcPath, JSON.stringify(cachedOutput), 'utf8');
          
        } catch (e: any) {
          console.error("[Earthquakes Daemon] Error fetching data:", e.message);
        }
        
        // Wait 15s before touching IPC again
        await new Promise(r => setTimeout(r, 15000));
      }
    }

run();
