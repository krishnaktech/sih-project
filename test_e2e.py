import io
import requests
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_full_pipeline():
    print("--- 1. Testing GET /api/nodes ---")
    res = client.get("/api/nodes")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) >= 20
    print(f"Nodes loaded: {len(data['nodes'])} cities/hubs across NE states.")

    print("\n--- 2. Testing GET /api/hazards ---")
    res = client.get("/api/hazards")
    assert res.status_code == 200
    hazards = res.json()
    assert len(hazards["incidents"]) > 0
    assert len(hazards["damaged_structures"]) > 0
    assert len(hazards["high_risk_zones"]) > 0
    print(f"Hazards: {len(hazards['incidents'])} incidents, {len(hazards['damaged_structures'])} structures, {len(hazards['high_risk_zones'])} risk zones.")

    print("\n--- 3. Testing GET /api/weather ---")
    res = client.get("/api/weather")
    assert res.status_code == 200
    weather = res.json()
    assert len(weather["weather_reports"]) > 0
    assert len(weather["alerts_ticker"]) > 0
    print(f"Weather stations reporting: {len(weather['weather_reports'])}, Tickers: {len(weather['alerts_ticker'])}")

    print("\n--- 4. Testing GET /api/emergency ---")
    res = client.get("/api/emergency")
    assert res.status_code == 200
    em = res.json()
    assert len(em["relief_camps"]) > 0
    assert len(em["emergency_contacts"]) > 0
    print(f"Emergency: {len(em['relief_camps'])} relief camps, {len(em['emergency_contacts'])} helplines.")

    print("\n--- 5. Testing POST /api/route (Guwahati to Silchar) ---")
    route_res = client.post("/api/route", json={
        "origin": "guwahati",
        "destination": "silchar",
        "vehicle_mode": "standard"
    })
    assert route_res.status_code == 200
    route_data = route_res.json()
    safest = route_data["safest_route"]
    direct = route_data["direct_route"]
    assert safest is not None
    assert direct is not None
    print(f"Safest Route: {safest['path_nodes']} (Risk: {safest['composite_risk_score']}%)")
    print(f"Direct Route: {direct['path_nodes']} (Risk: {direct['composite_risk_score']}%)")
    assert safest["composite_risk_score"] < direct["composite_risk_score"]

    print("\n--- 6. Testing POST /api/reports (Photo Upload & Incident Reporting) ---")
    fake_img = io.BytesIO(b"Fake image bytes for testing disaster photo upload")
    fake_img.name = "field_test_landslide.jpg"

    report_payload = {
        "hazard_type": "landslide",
        "title": "Fresh Rockfall on Shillong Bypass",
        "description": "Large boulder fell across eastbound lane. Emergency clearance underway.",
        "latitude": 25.6120,
        "longitude": 91.9540,
        "severity": "high",
        "reporter_name": "Meghalaya Traffic Police"
    }

    upload_res = client.post(
        "/api/reports",
        data=report_payload,
        files={"photo": ("field_test_landslide.jpg", fake_img, "image/jpeg")}
    )
    assert upload_res.status_code == 200
    up_data = upload_res.json()
    assert up_data["success"] is True
    new_id = up_data["incident"]["id"]
    print(f"Report uploaded successfully with id {new_id}, photo_url: {up_data['incident']['photo_url']}")

    print("\n--- 7. Testing Incident Upvoting ---")
    upvote_res = client.post(f"/api/reports/{new_id}/upvote")
    assert upvote_res.status_code == 200
    assert upvote_res.json()["upvotes"] >= 2
    print(f"Upvoted incident {new_id}. Current upvotes: {upvote_res.json()['upvotes']}")

    print("\nALL API AND SYSTEM PIPELINE TESTS PASSED 100%!")

if __name__ == "__main__":
    test_full_pipeline()
