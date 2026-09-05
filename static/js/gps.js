// AapdaMarg NE - Real-Time GPS Tracking & Proximity Alert Subsystem

let gpsWatchId = null;
let currentGpsCoords = null; // { lat, lng, accuracy, speed, heading, altitude }
let userGpsMarker = null;
let userAccuracyCircle = null;
let followGps = true;
let isGpsActive = false;

// Drive Simulator State
let simulatorInterval = null;
let isSimulating = false;
let simIndex = 0;
let simRoute = [];

// Audio Context for Danger Proximity Beep
let audioCtx = null;

function initGpsSubsystem() {
    console.log("Initializing Real-Time GPS Subsystem...");
    // Auto-locate once on startup to place user
    requestInitialLocation();
}

function requestInitialLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                handleGpsUpdate(pos);
            },
            (err) => {
                console.log("Initial geolocation notice:", err.message);
            },
            { enableHighAccuracy: true, timeout: 6000 }
        );
    }
}

function toggleGpsTracking() {
    const btn = document.getElementById('btnToggleGps');
    if (isGpsActive) {
        stopRealtimeGps();
        if (btn) {
            btn.innerHTML = '📍 Live GPS: OFF';
            btn.classList.remove('btn-gps-active');
        }
    } else {
        startRealtimeGps();
        if (btn) {
            btn.innerHTML = '📡 Live GPS: ACTIVE';
            btn.classList.add('btn-gps-active');
        }
    }
}

function startRealtimeGps() {
    if (!("geolocation" in navigator)) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    if (isSimulating) {
        stopDriveSimulator();
    }

    isGpsActive = true;
    document.getElementById('gpsHudBar').style.display = 'flex';

    gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            handleGpsUpdate(pos);
        },
        (err) => {
            console.warn("GPS watch error:", err.message);
            document.getElementById('hudGpsStatus').innerText = "Signal Weak";
        },
        {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 10000
        }
    );
}

function stopRealtimeGps() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    isGpsActive = false;
    document.getElementById('hudGpsStatus').innerText = "Inactive";
}

function handleGpsUpdate(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy || 15;
    const speed = pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(0) : "0";
    const altitude = pos.coords.altitude ? `${pos.coords.altitude.toFixed(0)}m` : "--";
    const heading = pos.coords.heading;

    currentGpsCoords = { lat, lng, accuracy, speed, heading, altitude };
    renderGpsMarkerOnMap(lat, lng, accuracy, heading);
    updateGpsHud(lat, lng, speed, altitude, accuracy);
    evaluateProximityThreats(lat, lng);

    if (followGps && map) {
        map.panTo([lat, lng]);
    }
}

function renderGpsMarkerOnMap(lat, lng, accuracy, heading) {
    if (!map) return;

    // Create or update Accuracy Circle
    if (!userAccuracyCircle) {
        userAccuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#38bdf8',
            fillColor: '#38bdf8',
            fillOpacity: 0.15,
            weight: 1
        }).addTo(map);
    } else {
        userAccuracyCircle.setLatLng([lat, lng]);
        userAccuracyCircle.setRadius(accuracy);
    }

    // Create or update glowing User Marker
    if (!userGpsMarker) {
        const gpsIcon = L.divIcon({
            className: 'user-gps-marker',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        userGpsMarker = L.marker([lat, lng], {
            icon: gpsIcon,
            zIndexOffset: 1000
        }).addTo(map);

        userGpsMarker.bindPopup(`
            <div style="color: #0f172a; font-size: 12px;">
                <strong style="color: #0284c7;">📍 Your Live GPS Location</strong>
                <div>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</div>
                <div>Accuracy: ±${accuracy.toFixed(0)} meters</div>
            </div>
        `);
    } else {
        userGpsMarker.setLatLng([lat, lng]);
    }
}

function updateGpsHud(lat, lng, speed, altitude, accuracy) {
    const hudBar = document.getElementById('gpsHudBar');
    if (hudBar) hudBar.style.display = 'flex';

    const elCoord = document.getElementById('hudCoords');
    const elSpeed = document.getElementById('hudSpeed');
    const elAlt = document.getElementById('hudAltitude');
    const elAccuracy = document.getElementById('hudAccuracy');
    const elStatus = document.getElementById('hudGpsStatus');

    if (elCoord) elCoord.innerText = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    if (elSpeed) elSpeed.innerText = `${speed} km/h`;
    if (elAlt) elAlt.innerText = altitude;
    if (elAccuracy) elAccuracy.innerText = `±${accuracy.toFixed(0)}m`;
    if (elStatus) elStatus.innerText = "Tracking";
}

// Proximity Threat & Early Warning Geofencing
async function evaluateProximityThreats(userLat, userLng) {
    try {
        const res = await fetch('/api/hazards');
        const data = await res.json();

        let closestHazard = null;
        let minDistance = 999999.0;

        // Check active incidents
        if (data.incidents) {
            data.incidents.forEach(inc => {
                const dist = calculateDistanceKm(userLat, userLng, inc.latitude, inc.longitude);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestHazard = { ...inc, distance_km: dist };
                }
            });
        }

        const elThreat = document.getElementById('hudThreatAlert');
        const banner = document.getElementById('hazardProximityBanner');
        const bannerText = document.getElementById('hazardBannerText');

        if (closestHazard) {
            if (minDistance <= 5.0) {
                // Critical Proximity Warning (< 5 km)
                if (elThreat) {
                    elThreat.className = "gps-hud-value danger";
                    elThreat.innerText = `🚨 ${closestHazard.distance_km.toFixed(1)} km!`;
                }

                if (banner && bannerText) {
                    banner.style.display = 'flex';
                    bannerText.innerHTML = `<strong>⚠️ IMMEDIATE PROXIMITY ALERT (${closestHazard.distance_km.toFixed(1)} km):</strong> ${closestHazard.title}. High threat to vehicle safety. Safe bypass recommended!`;
                }
                playWarningBeep();
            } else if (minDistance <= 20.0) {
                // Caution (< 20 km)
                if (elThreat) {
                    elThreat.className = "gps-hud-value";
                    elThreat.style.color = "#f59e0b";
                    elThreat.innerText = `⚠️ ${closestHazard.distance_km.toFixed(1)} km`;
                }
                if (banner) banner.style.display = 'none';
            } else {
                // Safe
                if (elThreat) {
                    elThreat.className = "gps-hud-value safe";
                    elThreat.innerText = `🛡️ Safe (${closestHazard.distance_km.toFixed(0)} km)`;
                }
                if (banner) banner.style.display = 'none';
            }
        }

    } catch (err) {
        console.error("Proximity evaluation error:", err);
    }
}

// Use GPS as origin for route computation
function useGpsAsOrigin() {
    if (!currentGpsCoords) {
        // Fetch current position directly
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    handleGpsUpdate(pos);
                    setGpsOrigin(pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                    // If denied or on desktop outside NE, offer Guwahati city GPS anchor
                    alert("Device GPS unavailable. Using Guwahati Central Anchor for test location.");
                    setGpsOrigin(26.1445, 91.7362);
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert("Geolocation not supported.");
        }
    } else {
        setGpsOrigin(currentGpsCoords.lat, currentGpsCoords.lng);
    }
}

function setGpsOrigin(lat, lng) {
    const originSelect = document.getElementById('originSelect');
    
    // Check if custom GPS option exists; if not, create it
    let gpsOption = originSelect.querySelector('option[value^="gps:"]');
    if (!gpsOption) {
        gpsOption = document.createElement('option');
        originSelect.insertBefore(gpsOption, originSelect.firstChild);
    }

    const val = `gps:${lat.toFixed(5)},${lng.toFixed(5)}`;
    gpsOption.value = val;
    gpsOption.textContent = `📍 My Live GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
    originSelect.value = val;

    // Trigger calculation
    calculateRoute();
}

// Center map on user GPS
function centerOnUserGps() {
    if (currentGpsCoords && map) {
        map.flyTo([currentGpsCoords.lat, currentGpsCoords.lng], 14);
        followGps = true;
    } else {
        useGpsAsOrigin();
    }
}

// Drive Simulator (Test GPS movement on desktop along real highway curves)
function toggleDriveSimulator() {
    if (isSimulating) {
        stopDriveSimulator();
    } else {
        startDriveSimulator();
    }
}

function startDriveSimulator() {
    // Need an active route road_polyline
    const activeRouteData = window.lastEvaluatedRoute;
    if (!activeRouteData || !activeRouteData.safest_route || !activeRouteData.safest_route.road_polyline) {
        alert("Please calculate a route first (e.g. Guwahati to Silchar) before starting Drive Simulation.");
        return;
    }

    simRoute = activeRouteData.safest_route.road_polyline;
    if (simRoute.length < 10) {
        alert("Route geometry too short for simulation.");
        return;
    }

    if (gpsWatchId) stopRealtimeGps();

    isSimulating = true;
    simIndex = 0;
    document.getElementById('gpsHudBar').style.display = 'flex';
    document.getElementById('hudGpsStatus').innerText = "Drive Sim (Active)";
    
    const simBtn = document.getElementById('btnDriveSim');
    if (simBtn) {
        simBtn.innerHTML = '⏹️ Stop GPS Sim';
        simBtn.style.background = '#dc2626';
    }

    // Advance vehicle position every 300ms (~50-80 km/h simulated movement)
    const stepJump = Math.max(1, Math.floor(simRoute.length / 400));

    simulatorInterval = setInterval(() => {
        if (simIndex >= simRoute.length) {
            simIndex = 0; // loop or finish
        }

        const point = simRoute[simIndex];
        const lat = point[0];
        const lng = point[1];

        handleGpsUpdate({
            coords: {
                latitude: lat,
                longitude: lng,
                accuracy: 8,
                speed: 15.5, // ~56 km/h
                altitude: 180 + Math.sin(simIndex) * 60,
                heading: 90
            }
        });

        simIndex += stepJump;
    }, 280);
}

function stopDriveSimulator() {
    if (simulatorInterval) {
        clearInterval(simulatorInterval);
        simulatorInterval = null;
    }
    isSimulating = false;
    document.getElementById('hudGpsStatus').innerText = "Sim Stopped";
    const simBtn = document.getElementById('btnDriveSim');
    if (simBtn) {
        simBtn.innerHTML = '🚗 Simulate GPS Drive';
        simBtn.style.background = '';
    }
}

// Proximity Warning Beep
function playWarningBeep() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
        // Audio policy restrictions
    }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
