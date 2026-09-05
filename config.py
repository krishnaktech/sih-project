import os

# Base Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(BASE_DIR, "ne_disaster.db")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# North East India Center Coordinates
NE_CENTER = {"lat": 26.1445, "lng": 91.7362, "zoom": 7}  # Guwahati as central anchor

# Key North East Hubs / Node Coordinates
NE_CITIES = {
    "guwahati": {"name": "Guwahati (Assam)", "lat": 26.1445, "lng": 91.7362, "state": "Assam", "elevation": 55},
    "shillong": {"name": "Shillong (Meghalaya)", "lat": 25.5788, "lng": 91.8933, "state": "Meghalaya", "elevation": 1525},
    "cherrapunji": {"name": "Sohra / Cherrapunji", "lat": 25.2986, "lng": 91.7317, "state": "Meghalaya", "elevation": 1430},
    "jowai": {"name": "Jowai (Meghalaya)", "lat": 25.4526, "lng": 92.2037, "state": "Meghalaya", "elevation": 1380},
    "sonapur": {"name": "Sonapur Tunnel (NH-6)", "lat": 25.1090, "lng": 92.3620, "state": "Meghalaya", "elevation": 420},
    "silchar": {"name": "Silchar (Barak Valley)", "lat": 24.8333, "lng": 92.7789, "state": "Assam", "elevation": 25},
    "haflong": {"name": "Haflong (Dima Hasao)", "lat": 25.1667, "lng": 93.0167, "state": "Assam", "elevation": 680},
    "lumding": {"name": "Lumding (Assam)", "lat": 25.7500, "lng": 93.1667, "state": "Assam", "elevation": 125},
    "nagaon": {"name": "Nagaon (Assam)", "lat": 26.3467, "lng": 92.6840, "state": "Assam", "elevation": 60},
    "tezpur": {"name": "Tezpur (Assam)", "lat": 26.6528, "lng": 92.7926, "state": "Assam", "elevation": 48},
    "kaziranga": {"name": "Kaziranga (NH-27)", "lat": 26.5775, "lng": 93.1711, "state": "Assam", "elevation": 53},
    "jorhat": {"name": "Jorhat (Assam)", "lat": 26.7509, "lng": 94.2037, "state": "Assam", "elevation": 116},
    "dibrugarh": {"name": "Dibrugarh (Upper Assam)", "lat": 27.4728, "lng": 94.9120, "state": "Assam", "elevation": 108},
    "tinsukia": {"name": "Tinsukia (Assam)", "lat": 27.5000, "lng": 95.3667, "state": "Assam", "elevation": 117},
    "itanagar": {"name": "Itanagar (Arunachal Pradesh)", "lat": 27.0844, "lng": 93.6053, "state": "Arunachal Pradesh", "elevation": 750},
    "bhalukpong": {"name": "Bhalukpong (Arunachal Gate)", "lat": 27.0125, "lng": 92.6433, "state": "Arunachal Pradesh", "elevation": 213},
    "bomdila": {"name": "Bomdila (Arunachal)", "lat": 27.2645, "lng": 92.4231, "state": "Arunachal Pradesh", "elevation": 2415},
    "tawang": {"name": "Tawang (Himalayan Pass)", "lat": 27.5861, "lng": 91.8594, "state": "Arunachal Pradesh", "elevation": 3048},
    "gangtok": {"name": "Gangtok (Sikkim)", "lat": 27.3389, "lng": 88.6065, "state": "Sikkim", "elevation": 1650},
    "rangpo": {"name": "Rangpo (Sikkim Border)", "lat": 27.1764, "lng": 88.5298, "state": "Sikkim", "elevation": 330},
    "siliguri": {"name": "Siliguri (Gateway to NE)", "lat": 26.7271, "lng": 88.3953, "state": "West Bengal", "elevation": 122},
    "dimapur": {"name": "Dimapur (Nagaland)", "lat": 25.9060, "lng": 93.7270, "state": "Nagaland", "elevation": 145},
    "kohima": {"name": "Kohima (Nagaland)", "lat": 25.6751, "lng": 94.1086, "state": "Nagaland", "elevation": 1444},
    "imphal": {"name": "Imphal (Manipur)", "lat": 24.8170, "lng": 93.9368, "state": "Manipur", "elevation": 786},
    "churachandpur": {"name": "Churachandpur (Manipur)", "lat": 24.3333, "lng": 93.6667, "state": "Manipur", "elevation": 914},
    "aizawl": {"name": "Aizawl (Mizoram)", "lat": 23.7271, "lng": 92.7176, "state": "Mizoram", "elevation": 1132},
    "lunglei": {"name": "Lunglei (Mizoram)", "lat": 22.8833, "lng": 92.7333, "state": "Mizoram", "elevation": 1222},
    "agartala": {"name": "Agartala (Tripura)", "lat": 23.8315, "lng": 91.2868, "state": "Tripura", "elevation": 12},
    "dharmanagar": {"name": "Dharmanagar (Tripura)", "lat": 24.3667, "lng": 92.1667, "state": "Tripura", "elevation": 21},
    "barpeta": {"name": "Barpeta (Lower Assam)", "lat": 26.3213, "lng": 91.0048, "state": "Assam", "elevation": 35},
    "dhubri": {"name": "Dhubri (Brahmaputra Port)", "lat": 26.0200, "lng": 89.9800, "state": "Assam", "elevation": 34},
    "majuli": {"name": "Majuli River Island", "lat": 26.9500, "lng": 94.2167, "state": "Assam", "elevation": 84}
}

HAZARD_TYPES = [
    {"id": "flood", "name": "Severe Flood / Waterlogging", "icon": "waves", "color": "#2563eb"},
    {"id": "landslide", "name": "Active Landslide / Mudflow", "icon": "mountain", "color": "#ea580c"},
    {"id": "damaged_bridge", "name": "Damaged / Weak Bridge", "icon": "construction", "color": "#dc2626"},
    {"id": "road_collapse", "name": "Road Collapse / Subsidence", "icon": "alert-triangle", "color": "#b91c1c"},
    {"id": "heavy_debris", "name": "Fallen Trees / Rock Debris", "icon": "trees", "color": "#d97706"},
    {"id": "cloudburst", "name": "Cloudburst / Flash Rain", "icon": "cloud-rain", "color": "#7c3aed"}
]

SEVERITY_LEVELS = [
    {"level": "low", "name": "Low (Passable with Caution)", "weight_penalty": 15, "badge": "bg-emerald-500"},
    {"level": "medium", "name": "Moderate (4x4 & High Clearance Only)", "weight_penalty": 45, "badge": "bg-amber-500"},
    {"level": "high", "name": "Severe (High Danger / Near Blocked)", "weight_penalty": 80, "badge": "bg-orange-600"},
    {"level": "critical", "name": "Impassable (Complete Road Cutoff / Collapsed)", "weight_penalty": 999, "badge": "bg-red-600"}
]
