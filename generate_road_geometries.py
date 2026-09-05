import json
import os
import time
import urllib.request
from config import NE_CITIES, BASE_DIR
from seed_data import NE_ROAD_NETWORK

CACHE_FILE = os.path.join(BASE_DIR, "road_geometry_cache.json")

def fetch_edge_geometry(u, v):
    u_city = NE_CITIES[u]
    v_city = NE_CITIES[v]
    
    # OSRM expects: {lng1},{lat1};{lng2},{lat2}
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{u_city['lng']},{u_city['lat']};{v_city['lng']},{v_city['lat']}"
        f"?overview=full&geometries=geojson"
    )
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AapdaMargNE/1.0'})
        with urllib.request.urlopen(req, timeout=6) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                if data.get("code") == "Ok" and data.get("routes"):
                    # GeoJSON is [lng, lat], convert to [lat, lng] for Leaflet
                    coords = [[round(p[1], 5), round(p[0], 5)] for p in data["routes"][0]["geometry"]["coordinates"]]
                    real_dist = round(data["routes"][0]["distance"] / 1000.0, 1)
                    return coords, real_dist
    except Exception as e:
        print(f"Error fetching {u} <-> {v}: {e}")
    
    # Fallback to direct coords
    fallback = [
        [u_city["lat"], u_city["lng"]],
        [v_city["lat"], v_city["lng"]]
    ]
    return fallback, None

def generate_cache():
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            cache = {}

    print(f"Generating real road geometry cache for {len(NE_ROAD_NETWORK)} North East highway edges...")
    
    for i, edge in enumerate(NE_ROAD_NETWORK):
        u, v = edge["u"], edge["v"]
        key = f"{u}_{v}"
        rev_key = f"{v}_{u}"
        
        if key in cache and len(cache[key]["coordinates"]) > 2:
            print(f"[{i+1}/{len(NE_ROAD_NETWORK)}] Cached: {u} -> {v} ({len(cache[key]['coordinates'])} pts)")
            continue
            
        print(f"[{i+1}/{len(NE_ROAD_NETWORK)}] Fetching: {u} -> {v} ...")
        coords, real_dist = fetch_edge_geometry(u, v)
        
        entry = {
            "coordinates": coords,
            "real_distance_km": real_dist if real_dist else edge["distance_km"]
        }
        cache[key] = entry
        
        # Reverse is inverted coordinates
        cache[rev_key] = {
            "coordinates": list(reversed(coords)),
            "real_distance_km": real_dist if real_dist else edge["distance_km"]
        }
        
        # Modest pause to be polite to public API
        time.sleep(0.3)

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=1)
        
    print(f"Successfully saved real road geometries to {CACHE_FILE}!")

if __name__ == "__main__":
    generate_cache()
