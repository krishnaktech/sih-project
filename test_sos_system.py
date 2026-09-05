import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_sos_system():
    print("\n--- 1. Testing GET /api/emergency/facilities ---")
    r = requests.get(f"{BASE_URL}/api/emergency/facilities")
    assert r.status_code == 200, f"Failed: {r.status_code}"
    data = r.json()
    facilities = data.get("facilities", [])
    print(f"Total emergency facilities loaded: {len(facilities)}")
    types = set(f["facility_type"] for f in facilities)
    print(f"Facility types: {types}")
    assert "police_station" in types and "hospital_ambulance" in types, "Missing facility types!"
    print("✓ Facilities verification passed.")

    print("\n--- 2. Testing POST /api/complaints (Medical Emergency near Guwahati) ---")
    payload_med = {
        "complaint_type": "ambulance",
        "emergency_nature": "critical_medical",
        "caller_name": "Dipak Kalita",
        "caller_phone": "+91-98640-11223",
        "latitude": 26.1520,
        "longitude": 91.7700,
        "location_address": "GS Road, Khanapara Flyover, Guwahati",
        "severity": "critical",
        "details": "Severe head injury victim following vehicle collision on slick road."
    }
    r = requests.post(f"{BASE_URL}/api/complaints", json=payload_med)
    assert r.status_code == 200, f"Failed: {r.status_code} - {r.text}"
    res = r.json()
    assert res.get("success"), "Expected success=True"
    primary = res["alert_dispatch"]["primary_responder"]
    print(f"Assigned Station: {primary['station_name']} ({primary['facility_type']})")
    print(f"Distance: {primary['distance_km']} km, ETA: {primary['eta_minutes']} mins")
    print(f"Assigned Unit: {primary['assigned_unit']}")
    assert "GMCH" in primary["station_name"] or "Gauhati" in primary["station_name"], "Nearest hospital should be GMCH!"
    print("✓ Nearest Hospital auto-alert passed.")

    print("\n--- 3. Testing POST /api/complaints (Police / Landslide Rescue near Sonapur Tunnel) ---")
    payload_police = {
        "complaint_type": "police",
        "emergency_nature": "landslide_trapped",
        "caller_name": "Habib Ali",
        "caller_phone": "+91-94350-44556",
        "latitude": 25.1090,
        "longitude": 92.3620,
        "location_address": "NH-6 Sonapur Tunnel North Portal",
        "severity": "critical",
        "details": "Passenger bus blocked by shooting stones and fallen mud. Rowdy crowd gathering."
    }
    r = requests.post(f"{BASE_URL}/api/complaints", json=payload_police)
    assert r.status_code == 200, f"Failed: {r.status_code} - {r.text}"
    res = r.json()
    primary = res["alert_dispatch"]["primary_responder"]
    print(f"Assigned Police Outpost: {primary['station_name']}")
    print(f"Distance: {primary['distance_km']} km, Unit: {primary['assigned_unit']}")
    assert primary["facility_type"] == "police_station", "Should assign police station!"
    print("✓ Nearest Police Station auto-alert passed.")

    print("\n--- 4. Testing POST /api/complaints (Combined Both Services near Silchar) ---")
    payload_both = {
        "complaint_type": "both",
        "emergency_nature": "stranded_flood",
        "caller_name": "S. Chakraborty",
        "caller_phone": "+91-98540-77889",
        "latitude": 24.8250,
        "longitude": 92.7990,
        "location_address": "Tarapur Lowland Colony, Silchar",
        "severity": "critical",
        "details": "Flood current washed away boundary wall. 4 family members including infant stranded on roof."
    }
    r = requests.post(f"{BASE_URL}/api/complaints", json=payload_both)
    assert r.status_code == 200, f"Failed: {r.status_code} - {r.text}"
    res = r.json()
    alert = res["alert_dispatch"]
    print(f"Primary Responder: {alert['primary_responder']['station_name']} ({alert['primary_responder']['distance_km']} km)")
    print(f"Secondary Escort: {alert['secondary_responder']['station_name']} ({alert['secondary_responder']['distance_km']} km)")
    assert alert["secondary_responder"] is not None, "Both services should include secondary responder!"
    print("✓ Dual Police + Ambulance auto-alert passed.")

    print("\n--- 5. Testing GET /api/complaints ---")
    r = requests.get(f"{BASE_URL}/api/complaints")
    assert r.status_code == 200
    complaints = r.json().get("complaints", [])
    print(f"Active emergency complaints tracked: {len(complaints)}")
    assert len(complaints) >= 6, "Expected newly created complaints in database!"
    print("✓ Complaints retrieval passed.")

    print("\n--- 6. Testing POST /api/complaints/{id}/status (Status Progression) ---")
    latest_id = complaints[0]["id"]
    r = requests.post(f"{BASE_URL}/api/complaints/{latest_id}/status", json={"status": "on_scene"})
    assert r.status_code == 200
    assert r.json()["complaint"]["dispatch_status"] == "on_scene"
    print(f"Complaint {latest_id} status successfully transitioned to: ON_SCENE")
    print("✓ Status update passed.")

    print("\n=======================================================")
    print("ALL POLICE & AMBULANCE EMERGENCY SOS TESTS PASSED 100%!")
    print("=======================================================")

if __name__ == "__main__":
    test_sos_system()
