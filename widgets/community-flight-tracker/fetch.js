export async function fetchData(config) {
  const lat = parseFloat(config.latitude) || 40.7128;
  const lon = parseFloat(config.longitude) || -74.0060;
  const radiusKm = parseFloat(config.radiusKm) || 100;

  // Approximate km to degrees for bounding box
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos(lat * (Math.PI / 180)));

  const lamin = lat - latDelta;
  const lamax = lat + latDelta;
  const lomin = lon - lonDelta;
  const lomax = lon + lonDelta;

  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PiDashboard-Community-Widget'
      }
    });
    if (!res.ok) throw new Error(`OpenSky API error: ${res.statusText}`);
    const data = await res.json();
    
    // OpenSky state vector indices: 
    // 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
    // 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
    // 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude, 14: squawk,
    // 15: spi, 16: position_source, 17: category
    
    const flights = (data.states || []).map(s => ({
      icao: s[0],
      callsign: (s[1] || '').trim() || 'UNKNOWN',
      origin: s[2],
      lon: s[5],
      lat: s[6],
      alt: s[7] || 0, // meters
      ground: s[8],
      vel: s[9] || 0, // m/s
      track: s[10] || 0, // degrees
      category: s[17] || 0
    })).filter(f => f.lat !== null && f.lon !== null);

    return { flights, timestamp: Date.now(), error: null };
  } catch (err) {
    return { flights: [], timestamp: Date.now(), error: err.message };
  }
}
