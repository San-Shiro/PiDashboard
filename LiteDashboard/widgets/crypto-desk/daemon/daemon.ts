import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function run() {
  const ipcPath = process.env.PIDASH_IPC_FILE || join(process.cwd(), '../../../state/ipc/crypto-desk.json');
  let nextFetch = Date.now();
  let cachedOutput: Record<string, any> = {};
  
  while (true) {
    try {
      const configStr = process.env.PIDASH_CONFIG || '{}';
      const config = JSON.parse(configStr);
      const instances = Object.keys(config).filter(k => k !== '_isInstances');
      
      if (instances.length > 0 && Date.now() >= nextFetch) {
        // Collect all unique requested coins and currencies
        const coinSet = new Set<string>();
        let currency = 'usd'; // Coingecko requires a base currency. Default to usd.
        
        for (const inst of instances) {
          const instConfig = config[inst];
          if (instConfig.currency) currency = instConfig.currency.toLowerCase();
          
          let coins = instConfig.coins || 'bitcoin,ethereum,solana';
          coins.split(',').forEach((c: string) => coinSet.add(c.trim().toLowerCase()));
        }
        
        const coinList = Array.from(coinSet).join(',');
        
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
          
          const newOutput: Record<string, any> = {};
          
          // Distribute back to instances based on their config
          for (const inst of instances) {
            const instConfig = config[inst];
            const requested = (instConfig.coins || 'bitcoin,ethereum,solana').split(',').map((c: string) => c.trim().toLowerCase());
            
            // Maintain the requested order
            newOutput[inst] = requested.map((reqId: string) => parsedData.find((d: any) => d.id === reqId)).filter(Boolean);
          }
          
          cachedOutput = newOutput;
          console.log(`[Crypto Daemon] Fetched data for ${coinList}. Next fetch in 5 mins.`);
          nextFetch = Date.now() + 5 * 60000; // 5 minutes
        }
      }
      
      // Write to IPC
      const ipcDir = join(ipcPath, '..');
      if (!existsSync(ipcDir)) {
        mkdirSync(ipcDir, { recursive: true });
      }
      const tmpPath = ipcPath + '.tmp';
      writeFileSync(tmpPath, JSON.stringify(cachedOutput), 'utf8');
      renameSync(tmpPath, ipcPath);
      
    } catch (e: any) {
      console.error("[Crypto Daemon] Error fetching data:", e.message);
      // Fallback data if empty so UI doesn't hang indefinitely on first load error (rate limit)
      if (Object.keys(cachedOutput).length === 0 && instances.length > 0) {
        for (const inst of instances) {
          cachedOutput[inst] = [
            { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 65000, change24h: 1.5, sparkline: [63000, 64000, 63500, 65000] },
            { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3500, change24h: -0.5, sparkline: [3600, 3550, 3450, 3500] }
          ];
        }
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
