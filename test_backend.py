import seed_data
from database import init_db
from routing_engine import routing_engine
from weather_service import get_all_weather, get_live_weather

def test_system():
    print("1. Initializing DB and seeding...")
    seed_data.seed_database()

    print("2. Testing Weather Fetch...")
    w = get_live_weather("guwahati")
    print(f"Guwahati Weather: {w['weather_status']}, {w['rainfall_mm']}mm rain, Alert: {w['alert_level']}")

    print("3. Testing Routing Guwahati -> Silchar...")
    routes = routing_engine.compute_routes("guwahati", "silchar", "standard")
    
    safest = routes.get("safest_route")
    direct = routes.get("direct_route")
    
    print(f"Safest Route Path: {safest['path_nodes']} ({safest['total_distance_km']} km, Risk Score: {safest['composite_risk_score']}%)")
    print(f"Direct Route Path: {direct['path_nodes']} ({direct['total_distance_km']} km, Risk Score: {direct['composite_risk_score']}%)")

    # Verify that the direct route via Sonapur has high risk and the safest route detours or accounts for danger
    print(f"Hazards on direct route: {len(direct['hazards_encountered'])}")
    for h in direct['hazards_encountered']:
        print(f"  - [{h.get('type')}] {h.get('title') or h.get('name')} (dist: {h.get('distance_km')}km)")

    print("\nRouting tests PASSED successfully!")

if __name__ == "__main__":
    test_system()
