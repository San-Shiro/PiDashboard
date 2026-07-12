export async function fetchData(config: any): Promise<any> {
  const locationName = config?.locationName || "London, UK";
  const units = config?.units || "metric";

  // Step 1: Geocoding
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&format=json`;
  const geoRes = await fetch(geoUrl);
  const geoData = await geoRes.json();

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`Location not found: ${locationName}`);
  }

  const { latitude, longitude, name } = geoData.results[0];

  // Step 2: Fetch Weather
  const tempUnitStr = units === "imperial" ? "fahrenheit" : "celsius";
  const windUnitStr = units === "imperial" ? "mph" : "kmh";
  
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${tempUnitStr}&wind_speed_unit=${windUnitStr}`;
  const weatherRes = await fetch(weatherUrl);
  const weatherData = await weatherRes.json();

  if (!weatherData.current) {
    throw new Error(`Weather data fetch failed for ${locationName}`);
  }

  return {
    location: name,
    temp: Math.round(weatherData.current.temperature_2m),
    weather_code: weatherData.current.weather_code,
    tempMax: Math.round(weatherData.daily.temperature_2m_max[0]),
    tempMin: Math.round(weatherData.daily.temperature_2m_min[0]),
    humidity: weatherData.current.relative_humidity_2m,
    windSpeed: Math.round(weatherData.current.wind_speed_10m),
    units,
    updated_at: Math.floor(Date.now() / 1000)
  };
}
