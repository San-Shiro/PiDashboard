import { writeFileSync, existsSync, mkdirSync, renameSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

async function run() {
  const ipcPath = process.env.PIDASH_IPC_FILE || join(process.cwd(), '../../../state/ipc/crypto-desk.json');
  let nextFetch = Date.now();
  let cachedOutput: any = null;
  
  while (true) {
    try {
      const ipcDir = process.env.PIDASH_IPC_DIR || join(process.cwd(), '../../../state/ipc');
      const cmdPath = join(ipcDir, `${process.env.PIDASH_DAEMON_ID || 'crypto-desk'}.cmd.json`);
      
      if (existsSync(cmdPath)) {
        try {
          const cmd = JSON.parse(readFileSync(cmdPath, 'utf8'));
          if (cmd.action === 'config_update' || cmd.action === 'refresh') {
            if (cmd.config) process.env.PIDASH_CONFIG = JSON.stringify(cmd.config);
            cachedOutput = null;
            nextFetch = Date.now();
            
            const tmpPath = ipcPath + '.tmp';
            writeFileSync(tmpPath, JSON.stringify([]), 'utf8');
            renameSync(tmpPath, ipcPath);
            console.log(`[Crypto Daemon] Received refresh/config_update. Cleared cache.`);
          }
        } catch(e) {}
        try { unlinkSync(cmdPath); } catch(e) {}
      }

      const configStr = process.env.PIDASH_CONFIG || '{}';
      const config = JSON.parse(configStr);
      
      if (Date.now() >= nextFetch) {
        let currency = (config.currency || 'usd').toLowerCase();
        let coins = (config.coins || 'bitcoin,ethereum,solana').split(',').map((c: string) => c.trim().toLowerCase());
        
        const coinList = coins.join(',');
        
        if (coinList.length > 0) {
          const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${coinList}&sparkline=true`;
          
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`CoinGecko API returned ${res.status} ${res.statusText}`);
          }
          const data = await res.json();
          
          // Map the raw data to a smaller payload
          const parsedData = data.map((coin: any) => {
            // Downsample sparkline from 168 points to ~24 points
            const rawSpark = coin.sparkline_in_7d?.price || [];
            const downsampled = [];
            const step = Math.max(1, Math.floor(rawSpark.length / 24));
            for (let i = 0; i < rawSpark.length; i += step) {
              downsampled.push(rawSpark[i]);
            }
            // Add the last point to ensure latest price is reflected
            if (rawSpark.length > 0) {
                downsampled.push(rawSpark[rawSpark.length - 1]);
            }
            
            return {
              id: coin.id,
              symbol: coin.symbol.toUpperCase(),
              name: coin.name,
              price: coin.current_price,
              change24h: coin.price_change_percentage_24h,
              sparkline: downsampled
            };
          });
          
          // Maintain the requested order
          cachedOutput = coins.map((reqId: string) => parsedData.find((d: any) => d.id === reqId)).filter(Boolean);
          
          console.log(`[Crypto Daemon] Fetched data for ${coinList}. Next fetch in 5 mins.`);
          nextFetch = Date.now() + 5 * 60000; // 5 minutes
        }
      }
      
      // Write to IPC
      if (cachedOutput) {
        const ipcDir = join(ipcPath, '..');
        if (!existsSync(ipcDir)) {
          mkdirSync(ipcDir, { recursive: true });
        }
        const tmpPath = ipcPath + '.tmp';
        writeFileSync(tmpPath, JSON.stringify(cachedOutput), 'utf8');
        renameSync(tmpPath, ipcPath);
      }
      
    } catch (e: any) {
      console.error("[Crypto Daemon] Error fetching data:", e.message);
      // Fallback data if empty so UI doesn't hang indefinitely on first load error (rate limit)
      if (!cachedOutput) {
        let coins = ((config.coins || 'bitcoin,ethereum,solana') as string).split(',').map((c: string) => c.trim().toLowerCase());
        cachedOutput = coins.map(coin => ({
          id: coin,
          symbol: coin.substring(0, 4).toUpperCase(),
          name: coin.charAt(0).toUpperCase() + coin.slice(1) + " (Rate Limited)",
          price: 0,
          change24h: 0,
          sparkline: [0, 0, 0, 0]
        }));
        
        const ipcDir = join(ipcPath, '..');
        if (!existsSync(ipcDir)) mkdirSync(ipcDir, { recursive: true });
        const tmpPath = ipcPath + '.tmp';
        writeFileSync(tmpPath, JSON.stringify(cachedOutput), 'utf8');
        renameSync(tmpPath, ipcPath);
      }
      // Wait a minute before retrying on failure
      nextFetch = Date.now() + 60000;
    }
    
    // Health check loop heartbeat
    await new Promise(r => setTimeout(r, 15000));
  }
}

run();
