import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_fleet_system():
    print("--- 1. Testing GET /api/amenities ---")
    res = requests.get(f"{BASE_URL}/api/amenities")
    assert res.status_code == 200, f"Failed: {res.text}"
    amenities = res.json()["amenities"]
    assert len(amenities) >= 10
    categories = set(a["category"] for a in amenities)
    print(f"Amenities count: {len(amenities)}, categories found: {categories}")
    assert "petrol_pump" in categories
    assert "hotel" in categories
    assert "restaurant" in categories

    print("\n--- 2. Testing GET /api/fleet ---")
    res = requests.get(f"{BASE_URL}/api/fleet")
    assert res.status_code == 200
    fleet = res.json()["vehicles"]
    assert len(fleet) >= 5
    cargo_types = set(v["cargo_type"] for v in fleet)
    print(f"Fleet vehicles: {len(fleet)}, cargo types: {cargo_types}")
    assert "medicines" in cargo_types
    assert "agricultural_produce" in cargo_types
    assert "construction_materials" in cargo_types
    assert "fuel_tanker" in cargo_types

    print("\n--- 3. Testing GET /api/alerts/logistics ---")
    res = requests.get(f"{BASE_URL}/api/alerts/logistics")
    assert res.status_code == 200
    alerts = res.json()["alerts"]
    print(f"Active automated logistics alerts generated: {len(alerts)}")
    assert len(alerts) > 0
    for a in alerts[:3]:
        print(f"  - [{a['severity'].upper()}] {a['title']}")

    print("\n--- 4. Testing POST /api/fleet/{id}/reroute ---")
    res = requests.post(f"{BASE_URL}/api/fleet/AS-01-MED-104/reroute")
    assert res.status_code == 200, f"Reroute error: {res.text}"
    r_data = res.json()
    assert r_data["success"] is True
    print(f"Reroute result: {r_data['message']}, new ETA: {r_data['eta_hours']} hrs")

    print("\n--- 5. Testing POST /api/sitreps (Field Official Report) ---")
    sitrep_payload = {
        "officer_name": "Major S. R. Lamba",
        "officer_rank": "2IC 1st Bn NDRF",
        "agency": "NDRF",
        "corridor": "NH-27 Mahasadak Dima Hasao",
        "district": "Dima Hasao",
        "latitude": 25.1667,
        "longitude": 93.0167,
        "clearance_pct": 85,
        "passability": "all_vehicles",
        "bridge_status": "intact",
        "notes": "Haflong hill bypass fully cleared for all relief convoys and fuel trucks."
    }
    res = requests.post(f"{BASE_URL}/api/sitreps", data=sitrep_payload)
    assert res.status_code == 200, f"SITREP error: {res.text}"
    print(f"SITREP posted successfully: ID {res.json()['sitrep']['id']}")

    print("\n--- 6. Testing GET /api/dashboard/stats (Centralized Command Dashboard) ---")
    res = requests.get(f"{BASE_URL}/api/dashboard/stats")
    assert res.status_code == 200
    stats = res.json()
    print(f"Command Dashboard KPIs: Convoys={stats['total_convoys']}, Critical Alerts={stats['critical_alerts_count']}")
    print(f"District Reserves monitored: {len(stats['district_reserves'])}")
    print(f"Corridors monitored: {len(stats['corridor_health'])}")

    print("\nALL SUPPLY CHAIN, AMENITIES & DASHBOARD TESTS PASSED 100%!")

if __name__ == "__main__":
    test_fleet_system()
