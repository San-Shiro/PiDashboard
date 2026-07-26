package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type Config struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	RadiusKm  float64 `json:"radiusKm"`
}

type OpenSkyResponse struct {
	States [][]interface{} `json:"states"`
}

type Flight struct {
	Icao     string  `json:"icao"`
	Callsign string  `json:"callsign"`
	Origin   string  `json:"origin"`
	Lon      float64 `json:"lon"`
	Lat      float64 `json:"lat"`
	Alt      float64 `json:"alt"`
	Ground   bool    `json:"ground"`
	Vel      float64 `json:"vel"`
	Track    float64 `json:"track"`
	Category int     `json:"category"`
}

type Output struct {
	Flights   []Flight `json:"flights"`
	Timestamp int64    `json:"timestamp"`
	Error     string   `json:"error,omitempty"`
}

func main() {
	ipcFile := os.Getenv("PIDASH_IPC_FILE")
	if ipcFile == "" {
		fmt.Println("PIDASH_IPC_FILE not set")
		os.Exit(1)
	}

	configStr := os.Getenv("PIDASH_CONFIG")
	var cfg Config
	if configStr != "" {
		json.Unmarshal([]byte(configStr), &cfg)
	}
	if cfg.Latitude == 0 {
		cfg.Latitude = 40.7128
	}
	if cfg.Longitude == 0 {
		cfg.Longitude = -74.0060
	}
	if cfg.RadiusKm == 0 {
		cfg.RadiusKm = 100
	}

	for {
		latDelta := cfg.RadiusKm / 111.32
		lonDelta := cfg.RadiusKm / (111.32 * math.Cos(cfg.Latitude*(math.Pi/180)))

		lamin := cfg.Latitude - latDelta
		lamax := cfg.Latitude + latDelta
		lomin := cfg.Longitude - lonDelta
		lomax := cfg.Longitude + lonDelta

		url := fmt.Sprintf("https://opensky-network.org/api/states/all?lamin=%f&lomin=%f&lamax=%f&lomax=%f", lamin, lomin, lamax, lomax)
		
		out := Output{Timestamp: time.Now().UnixMilli(), Flights: []Flight{}}

		req, _ := http.NewRequest("GET", url, nil)
		req.Header.Set("User-Agent", "PiDashboard-Go-Widget")
		
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)

		if err != nil {
			out.Error = err.Error()
		} else {
			defer resp.Body.Close()
			if resp.StatusCode != 200 {
				out.Error = fmt.Sprintf("API error: %s", resp.Status)
			} else {
				var data OpenSkyResponse
				body, _ := ioutil.ReadAll(resp.Body)
				json.Unmarshal(body, &data)

				for _, s := range data.States {
					if len(s) < 18 {
						continue
					}
					lon, ok1 := s[5].(float64)
					lat, ok2 := s[6].(float64)
					if !ok1 || !ok2 {
						continue
					}

					icao, _ := s[0].(string)
					callsign, _ := s[1].(string)
					origin, _ := s[2].(string)
					alt, _ := s[7].(float64)
					ground, _ := s[8].(bool)
					vel, _ := s[9].(float64)
					track, _ := s[10].(float64)
					catFloat, _ := s[17].(float64)
					
					out.Flights = append(out.Flights, Flight{
						Icao:     icao,
						Callsign: callsign,
						Origin:   origin,
						Lon:      lon,
						Lat:      lat,
						Alt:      alt,
						Ground:   ground,
						Vel:      vel,
						Track:    track,
						Category: int(catFloat),
					})
				}
			}
		}

		outBytes, _ := json.Marshal(out)
		tmpFile := filepath.Join(filepath.Dir(ipcFile), "." + filepath.Base(ipcFile) + ".tmp")
		ioutil.WriteFile(tmpFile, outBytes, 0644)
		os.Rename(tmpFile, ipcFile)
        fmt.Printf("Wrote %d flights to %s\n", len(out.Flights), ipcFile)

		time.Sleep(30 * time.Second)
	}
}
