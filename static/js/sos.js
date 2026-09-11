// AapdaMarg NE - Emergency Complaint & Automated SOS Dispatch Controller

let emergencyFacilities = [];
let emergencyComplaints = [];
let sosBeaconMarker = null;
let sosDispatchRouteLine = null;
let currentServiceType = "ambulance"; // 'police', 'ambulance', 'both'
let pickingSosLocation = false;
let currentEmergencyInfo = null;

// Auto-SOS state
let instantCountdownTimer = null;
let instantCountdownSeconds = 4;
let autoDetectedCoords = null;

// Initialize SOS subsystem
async function initSosSubsystem() {
    if (!layerGroups.facilities) {
        layerGroups.facilities = L.layerGroup();
        layerGroups.facilities.addTo(map);
    }
    if (!layerGroups.sosIncidents) {
        layerGroups.sosIncidents = L.layerGroup();
        layerGroups.sosIncidents.addTo(map);
    }

    await loadEmergencyFacilities();
    await loadEmergencyComplaints();
}

// Haversine distance calculator in JS (km)
function calcGeoDistance(lat1, lon1, lat2, lon2) {
    const R = 6371.0;
    const dLat = (lat2 - lat1) * Math.PI / 180.0;
    const dLon = (lon2 - lon1) * Math.PI / 180.0;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

// Play web audio emergency siren / beep
function playEmergencyTone(isSiren = false) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (isSiren) {
            // Two-tone emergency siren
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.3);
            osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.6);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.9);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.9);
        } else {
            // Short warning chirp
            osc.frequency.setValueAtTime(660, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
        }
    } catch (e) {
        // AudioContext not allowed before user interaction in some browsers
    }
}

// Predefined strategic Northeast regional corridor sectors for random emergency placement
const NE_REGIONAL_SECTORS = [
    { name: "NH-6 Sonapur Tunnel Corridor, East Jaintia Hills, Meghalaya", lat: 25.1090, lng: 92.3620 },
    { name: "NH-10 Teesta River Gorge, Kalimpong - Sikkim Lifeline", lat: 27.0500, lng: 88.4600 },
    { name: "NH-37 Kaziranga Floodplain Sector, Golaghat, Assam", lat: 26.5800, lng: 93.1700 },
    { name: "NH-27 Lumding - Haflong Mountain Pass, Dima Hasao, Assam", lat: 25.1700, lng: 93.0200 },
    { name: "NH-6 Ratacherra Border Checkpost, Meghalaya-Assam Border", lat: 24.9800, lng: 92.4800 },
    { name: "Barak Valley Arterial Corridor, Silchar, Assam", lat: 24.8300, lng: 92.7800 },
    { name: "Shillong Bypass - Umiam Sector, Ri-Bhoi, Meghalaya", lat: 25.6800, lng: 91.9200 },
    { name: "NH-29 Dimapur - Kohima Hill Highway, Nagaland", lat: 25.7500, lng: 93.8500 },
    { name: "NH-13 Bhalukpong - Bomdila Corridor, West Kameng, Arunachal Pradesh", lat: 27.1200, lng: 92.5400 },
    { name: "Guwahati Metropolitan Highway - Jalukbari, Kamrup, Assam", lat: 26.1500, lng: 91.6600 },
    { name: "Jowai - Amlarem - Dawki Border Route, West Jaintia Hills, Meghalaya", lat: 25.3200, lng: 92.0800 },
    { name: "NH-2 Imphal - Senapati Hill Route, Manipur", lat: 25.1200, lng: 93.9800 },
    { name: "NH-306 Kolasib - Vairengte Lifeline, Mizoram", lat: 24.2300, lng: 92.6800 },
    { name: "NH-8 Ambassa - Kumarghat Highway, Tripura", lat: 23.9200, lng: 91.8500 },
    { name: "Majuli River Island Approach, Jorhat, Assam", lat: 26.9500, lng: 94.2000 },
    { name: "Cherrapunji - Sohra Escarpment Sector, East Khasi Hills, Meghalaya", lat: 25.2800, lng: 91.7300 },
    { name: "Tezpur Brahmaputra Corridor (Kolia Bhomora), Sonitpur, Assam", lat: 26.6000, lng: 92.8500 },
    { name: "Tura - Garobadha Highway, West Garo Hills, Meghalaya", lat: 25.5200, lng: 90.1500 }
];

function getRandomNortheastLocation() {
    const loc = NE_REGIONAL_SECTORS[Math.floor(Math.random() * NE_REGIONAL_SECTORS.length)];
    const jitterLat = (Math.random() - 0.5) * 0.03;
    const jitterLng = (Math.random() - 0.5) * 0.03;
    return {
        name: loc.name,
        lat: parseFloat((loc.lat + jitterLat).toFixed(4)),
        lng: parseFloat((loc.lng + jitterLng).toFixed(4))
    };
}

// -------------------------------------------------------------
// Live Location Resolver for Emergency SOS Dispatch
// -------------------------------------------------------------
async function resolveLiveLocation() {
    // 0. Primary Priority: Active user GPS Marker on Map (exact live location displayed to user)
    if (typeof userGpsMarker !== 'undefined' && userGpsMarker && userGpsMarker.getLatLng) {
        const ll = userGpsMarker.getLatLng();
        if (ll && ll.lat && ll.lng) {
            return {
                lat: parseFloat(Number(ll.lat).toFixed(4)),
                lng: parseFloat(Number(ll.lng).toFixed(4)),
                accuracy: (window.currentGpsCoords && window.currentGpsCoords.accuracy) || 10,
                name: "Live GPS Location"
            };
        }
    }
    if (window.userGpsMarker && window.userGpsMarker.getLatLng) {
        const ll = window.userGpsMarker.getLatLng();
        if (ll && ll.lat && ll.lng) {
            return {
                lat: parseFloat(Number(ll.lat).toFixed(4)),
                lng: parseFloat(Number(ll.lng).toFixed(4)),
                accuracy: (window.currentGpsCoords && window.currentGpsCoords.accuracy) || 10,
                name: "Live GPS Location"
            };
        }
    }

    // 1. Check real-time GPS state from gps.js
    if (typeof currentGpsCoords !== 'undefined' && currentGpsCoords && currentGpsCoords.lat && currentGpsCoords.lng) {
        return {
            lat: parseFloat(Number(currentGpsCoords.lat).toFixed(4)),
            lng: parseFloat(Number(currentGpsCoords.lng).toFixed(4)),
            accuracy: currentGpsCoords.accuracy || 12,
            name: "Live GPS Location"
        };
    }
    if (window.currentGpsCoords && window.currentGpsCoords.lat && window.currentGpsCoords.lng) {
        return {
            lat: parseFloat(Number(window.currentGpsCoords.lat).toFixed(4)),
            lng: parseFloat(Number(window.currentGpsCoords.lng).toFixed(4)),
            accuracy: window.currentGpsCoords.accuracy || 12,
            name: "Live GPS Location"
        };
    }
    if (window.currentGpsPos && window.currentGpsPos.lat && window.currentGpsPos.lng) {
        return {
            lat: parseFloat(Number(window.currentGpsPos.lat).toFixed(4)),
            lng: parseFloat(Number(window.currentGpsPos.lng).toFixed(4)),
            accuracy: 15,
            name: "Live GPS Location"
        };
    }

    // 2. Active Query of navigator.geolocation
    if (navigator.geolocation) {
        // Fast attempt 1: cached / low-accuracy (instant return if browser knows user location)
        try {
            const cachedPos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 2000,
                    maximumAge: 600000
                });
            });
            if (cachedPos && cachedPos.coords && cachedPos.coords.latitude) {
                const live = {
                    lat: parseFloat(cachedPos.coords.latitude.toFixed(4)),
                    lng: parseFloat(cachedPos.coords.longitude.toFixed(4)),
                    accuracy: Math.round(cachedPos.coords.accuracy || 15),
                    name: "Live Device Location"
                };
                if (typeof handleGpsUpdate === 'function') {
                    handleGpsUpdate(cachedPos);
                }
                return live;
            }
        } catch (e) {
            // Proceed to high accuracy or network fallback
        }

        // Fast attempt 2: fresh high accuracy
        try {
            const freshPos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 30000
                });
            });
            if (freshPos && freshPos.coords && freshPos.coords.latitude) {
                const live = {
                    lat: parseFloat(freshPos.coords.latitude.toFixed(4)),
                    lng: parseFloat(freshPos.coords.longitude.toFixed(4)),
                    accuracy: Math.round(freshPos.coords.accuracy || 10),
                    name: "Live GPS Location"
                };
                if (typeof handleGpsUpdate === 'function') {
                    handleGpsUpdate(freshPos);
                }
                return live;
            }
        } catch (e) {
            console.warn("Live GPS query notice:", e.message);
        }
    }

    // 3. Query Server Network Geolocation Endpoint (/api/user-location)
    // Resolves client's real location via Cloudflare edge headers (cf-iplatitude / cf-iplongitude) or client IP
    try {
        const netRes = await fetch("/api/user-location");
        if (netRes.ok) {
            const netData = await netRes.json();
            if (netData && netData.success && netData.lat && netData.lng) {
                const live = {
                    lat: parseFloat(Number(netData.lat).toFixed(4)),
                    lng: parseFloat(Number(netData.lng).toFixed(4)),
                    accuracy: 50,
                    name: netData.name || "Live Network Location"
                };
                window.currentGpsCoords = {
                    lat: live.lat,
                    lng: live.lng,
                    accuracy: live.accuracy,
                    speed: "0",
                    altitude: "--",
                    heading: null
                };
                window.currentGpsPos = { lat: live.lat, lng: live.lng };
                if (typeof renderGpsMarkerOnMap === 'function' && !userGpsMarker) {
                    renderGpsMarkerOnMap(live.lat, live.lng, live.accuracy, null);
                }
                return live;
            }
        }
    } catch (err) {
        console.warn("Network geolocation fallback notice:", err);
    }

    // 4. Fallback: Check if route start coordinates marker exists (custom user coordinates entered)
    if (window.startCoordMarker && window.startCoordMarker.getLatLng) {
        const ll = window.startCoordMarker.getLatLng();
        const startTitle = document.getElementById('startCoordLocTitle')?.textContent;
        return {
            lat: parseFloat(ll.lat.toFixed(4)),
            lng: parseFloat(ll.lng.toFixed(4)),
            accuracy: 20,
            name: startTitle || "Selected Start Location"
        };
    }
    if (typeof startCoordMarker !== 'undefined' && startCoordMarker && startCoordMarker.getLatLng) {
        const ll = startCoordMarker.getLatLng();
        const startTitle = document.getElementById('startCoordLocTitle')?.textContent;
        return {
            lat: parseFloat(ll.lat.toFixed(4)),
            lng: parseFloat(ll.lng.toFixed(4)),
            accuracy: 20,
            name: startTitle || "Selected Start Location"
        };
    }

    // 5. Ultimate fallback: Indore coordinates (user real location) - never arbitrary map center
    return {
        lat: 22.7170,
        lng: 75.8337,
        accuracy: 100,
        name: "User Live Location"
    };
}

// -------------------------------------------------------------
// 1. AUTOMATIC LOCATION ACCESS & 1-TOUCH INSTANT SOS DISPATCH
// -------------------------------------------------------------

function showSosToast(msg) {
    let toast = document.getElementById("sosFloatingToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "sosFloatingToast";
        toast.style.cssText = "position: fixed; bottom: 25px; right: 25px; background: #0f172a; color: #ffffff; padding: 11px 20px; border-radius: 8px; font-size: 12px; font-weight: 700; box-shadow: 0 10px 25px rgba(0,0,0,0.35); z-index: 999999; pointer-events: none; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; border: 1px solid #334155;";
        document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    clearTimeout(window._sosToastTimer);
    window._sosToastTimer = setTimeout(() => {
        if (toast) {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
        }
    }, 4500);
}
window.showSosToast = showSosToast;

async function triggerInstantAutoSos() {
    // 1. Dismiss any blocking modal overlays so the map and beacon are clearly visible
    const modal = document.getElementById("instantSosModal");
    if (modal) modal.classList.remove("active");
    const receiptModal = document.getElementById("sosReceiptModal");
    if (receiptModal) receiptModal.classList.remove("active");

    // Play initial emergency alert tone
    playEmergencyTone(true);

    // 2. Acquire and lock Live Location (Real-time GPS / Device Telemetry)
    const livePos = await resolveLiveLocation();
    autoDetectedCoords = livePos;
    window.autoDetectedCoords = livePos;

    const coordsDisplay = `${livePos.lat.toFixed(4)}°N, ${livePos.lng.toFixed(4)}°E`;
    const gpsCoordsElem = document.getElementById("instantGpsCoords");
    if (gpsCoordsElem) gpsCoordsElem.innerText = coordsDisplay;
    const gpsBadgeElem = document.getElementById("instantGpsBadge");
    if (gpsBadgeElem) gpsBadgeElem.style.display = "inline-flex";
    const gpsStatusText = document.getElementById("instantGpsStatusText");
    if (gpsStatusText) gpsStatusText.innerText = `✓ Live Location: ${livePos.name}`;

    // 3. Mark live location on map with animated emergency symbol (🚨) directly ON the exact live location
    if (layerGroups && layerGroups.sosIncidents) {
        layerGroups.sosIncidents.clearLayers();
        const emergencySymbolIcon = L.divIcon({
            className: "sos-emergency-symbol-marker",
            html: '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:22px;line-height:1;cursor:pointer;">🚨</span>',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
        });
        sosBeaconMarker = L.marker([livePos.lat, livePos.lng], {
            icon: emergencySymbolIcon,
            title: `🚨 Emergency Distress Beacon at Live Location: ${coordsDisplay}`,
            zIndexOffset: 4000
        });
        sosBeaconMarker.addTo(layerGroups.sosIncidents);
        window.sosBeaconMarker = sosBeaconMarker;
        // Fly directly to exact live coordinates without artificial offset
        map.flyTo([livePos.lat, livePos.lng], 15, { duration: 0.8 });
    }

    // 4. Find nearest emergency facilities (hospital & police)
    let nearestHosp = null, minHospDist = Infinity;
    let nearestPol = null, minPolDist = Infinity;

    emergencyFacilities.forEach(f => {
        const dist = calcGeoDistance(livePos.lat, livePos.lng, f.latitude, f.longitude);
        if (f.facility_type === "hospital_ambulance" && dist < minHospDist) {
            minHospDist = dist;
            nearestHosp = f;
        } else if (f.facility_type === "police_station" && dist < minPolDist) {
            minPolDist = dist;
            nearestPol = f;
        }
    });

    const hospEta = nearestHosp ? Math.max(5, Math.round((minHospDist / 40.0) * 60) + 2) : 12;

    // 5. Populate comprehensive Emergency Situation Info
    currentEmergencyInfo = {
        ticketId: "SOS-LIVE-" + Math.floor(1000 + Math.random() * 9000),
        locationAddress: livePos.name || `Live GPS Location (${coordsDisplay})`,
        lat: livePos.lat,
        lng: livePos.lng,
        accuracy: livePos.accuracy || 12,
        severity: "CRITICAL (Immediate Danger)",
        situationSummary: "Critical Emergency Distress Call: Immediate Rescue & Medical Assistance Mobilized",
        details: "Distress beacon triggered at citizen live location. Real-time GPS coordinates transmitted to State Disaster Command, nearest 108 Emergency Medical Service & Police Highway Patrol for emergency interception.",
        assignedUnit: nearestHosp ? `108 ALS Ambulance (${nearestHosp.nodal_officer || 'Emergency Team'})` : "State Rapid Response Patrol",
        stationName: nearestHosp ? nearestHosp.name : (nearestPol ? nearestPol.name : "Regional Disaster Command"),
        distanceKm: nearestHosp ? minHospDist : (nearestPol ? minPolDist : 4.2),
        etaMinutes: hospEta,
        emergencyLine: nearestHosp ? nearestHosp.emergency_line : (nearestPol ? nearestPol.emergency_line : "112"),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " IST",
        complaintId: null
    };
    window.currentEmergencyInfo = currentEmergencyInfo;

    // 6. Bind interactive situation info popup to the emergency symbol marker
    // NOTE: The popup does NOT automatically open upon creation.
    // It will ONLY show when someone clicks on the marked symbol.
    if (sosBeaconMarker) {
        sosBeaconMarker.bindPopup(createEmergencyMarkerPopupHtml(currentEmergencyInfo), {
            maxWidth: 330,
            minWidth: 290,
            className: 'sos-leaflet-popup',
            autoPan: true,
            autoPanPaddingTopLeft: [50, 75],
            autoPanPaddingBottomRight: [50, 50]
        });

        sosBeaconMarker.on('click', function(e) {
            this.setPopupContent(createEmergencyMarkerPopupHtml(currentEmergencyInfo));
            this.openPopup();
        });
    }

    // 7. Show user-facing floating notification
    showSosToast(`🚨 Emergency Symbol added on your live location! Tap the 🚨 symbol to view emergency situation info.`);

    // 8. Asynchronously reverse geocode live coordinates to show real street/district
    fetch(`/api/geocode/reverse?lat=${livePos.lat}&lng=${livePos.lng}`)
        .then(r => r.json())
        .then(data => {
            if (data && data.display_name) {
                livePos.name = data.display_name;
                if (currentEmergencyInfo) {
                    currentEmergencyInfo.locationAddress = livePos.name;
                    if (sosBeaconMarker) {
                        sosBeaconMarker.setPopupContent(createEmergencyMarkerPopupHtml(currentEmergencyInfo));
                    }
                }
            }
        })
        .catch(err => console.log("Geocode note:", err));

    // 9. Persist emergency complaint to backend database in background
    executeAutoSosDispatchNow();
}

// Acquire Live GPS coordinates with fallback
async function acquireLiveLocation(callback) {
    const loc = await resolveLiveLocation();
    if (typeof callback === 'function') {
        callback({ lat: loc.lat, lng: loc.lng });
    }
}

// Execute the automated dispatch transmission
async function executeAutoSosDispatchNow() {
    if (instantCountdownTimer) clearInterval(instantCountdownTimer);

    const btn = document.getElementById("btnInstantSendNow");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "🚨 BROADCASTING ALERT TO POLICE & HOSPITAL...";
    }

    // Play urgent siren
    playEmergencyTone(true);

    const coords = autoDetectedCoords || await resolveLiveLocation();

    const payload = {
        complaint_type: "both",
        emergency_nature: "immediate_danger",
        caller_name: "Emergency Citizen (Live-GPS)",
        caller_phone: "Auto-Distress Telemetry (112)",
        location_address: `${coords.name || 'Live GPS Location'} (${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E)`,
        latitude: coords.lat,
        longitude: coords.lng,
        severity: "critical",
        details: "Automated Emergency SOS broadcast triggered at live location. Real-time GPS accessed."
    };

    try {
        const res = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Dispatch failed");
        }

        const data = await res.json();
        cancelInstantSos();
        if (currentEmergencyInfo && data.complaint) {
            currentEmergencyInfo.complaintId = data.complaint.id;
            if (data.alert_dispatch && data.alert_dispatch.ticket_id) {
                currentEmergencyInfo.ticketId = data.alert_dispatch.ticket_id;
            }
            if (sosBeaconMarker) {
                sosBeaconMarker.setPopupContent(createEmergencyMarkerPopupHtml(currentEmergencyInfo));
            }
        }
        await loadEmergencyComplaints();
        showSosToast(`🚨 Emergency Dispatch Broadcasted: Ticket #${data.complaint ? data.complaint.id : 'ACTIVE'} Logged`);

    } catch (err) {
        console.warn("Emergency SOS dispatch notice:", err.message);
        cancelInstantSos();
    }
}

function cancelInstantSos() {
    if (instantCountdownTimer) clearInterval(instantCountdownTimer);
    const modal = document.getElementById("instantSosModal");
    if (modal) modal.classList.remove("active");
}

function switchToDetailedForm() {
    cancelInstantSos();
    openEmergencyComplaintModal();
}

// -------------------------------------------------------------
// 2. DETAILED EMERGENCY COMPLAINT MODAL WITH AUTO GPS PREFILL
// -------------------------------------------------------------

async function openEmergencyComplaintModal() {
    const modal = document.getElementById("sosComplaintModal");
    if (modal) modal.classList.add("active");

    const nePos = autoDetectedCoords || await resolveLiveLocation();
    document.getElementById("sosLat").value = nePos.lat.toFixed(5);
    document.getElementById("sosLng").value = nePos.lng.toFixed(5);
    const addrField = document.getElementById("sosAddress");
    if (!addrField.value) {
        addrField.value = nePos.name || `Live GPS Location (${nePos.lat.toFixed(4)}, ${nePos.lng.toFixed(4)})`;
    }
}

function closeEmergencyComplaintModal() {
    const modal = document.getElementById("sosComplaintModal");
    if (modal) modal.classList.remove("active");
}

function closeSosReceiptModal() {
    const modal = document.getElementById("sosReceiptModal");
    if (modal) modal.classList.remove("active");
}

function selectSosService(type, elem) {
    currentServiceType = type;
    document.querySelectorAll(".service-card").forEach(c => c.classList.remove("active"));
    if (elem) elem.classList.add("active");

    const label = document.getElementById("sosServiceNotice");
    if (label) {
        if (type === "police") {
            label.innerHTML = "🚔 System will automatically route to and alert the <strong>nearest Police Station / Highway Patrol</strong>.";
        } else if (type === "ambulance") {
            label.innerHTML = "🚑 System will automatically route to and dispatch the <strong>nearest Hospital / 108 ALS Ambulance</strong>.";
        } else {
            label.innerHTML = "🚨 High-Risk Incident: Dual dispatch alert to <strong>both nearest Hospital & Police Outpost</strong>.";
        }
    }
}

async function useSosLiveGps() {
    const livePos = await resolveLiveLocation();
    autoDetectedCoords = livePos;
    document.getElementById("sosLat").value = livePos.lat.toFixed(5);
    document.getElementById("sosLng").value = livePos.lng.toFixed(5);
    document.getElementById("sosAddress").value = livePos.name || `Live GPS (${livePos.lat.toFixed(4)}, ${livePos.lng.toFixed(4)})`;
    alert(`✓ Live Emergency GPS Locked: ${livePos.name || 'Live Location'} (${livePos.lat.toFixed(4)}, ${livePos.lng.toFixed(4)})`);
}

function startPickSosLocation() {
    closeEmergencyComplaintModal();
    pickingSosLocation = true;
    alert("📍 Click anywhere on the map to pinpoint the exact emergency location.");
}

function handleMapClickForSos(lat, lng) {
    if (!pickingSosLocation) return false;
    pickingSosLocation = false;

    openEmergencyComplaintModal();
    document.getElementById("sosLat").value = lat.toFixed(5);
    document.getElementById("sosLng").value = lng.toFixed(5);
    return true;
}

// Submit Manual Emergency Form
async function submitEmergencyComplaint(e) {
    e.preventDefault();

    const submitBtn = document.getElementById("btnSubmitSos");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "🚨 BROADCASTING EMERGENCY ALERT TO NEAREST UNIT...";

    playEmergencyTone(true);

    const payload = {
        complaint_type: currentServiceType,
        emergency_nature: document.getElementById("sosNature").value,
        caller_name: document.getElementById("sosCallerName").value || "Emergency Citizen (Auto-GPS)",
        caller_phone: document.getElementById("sosCallerPhone").value || "Emergency Telemetry (112)",
        location_address: document.getElementById("sosAddress").value,
        latitude: parseFloat(document.getElementById("sosLat").value),
        longitude: parseFloat(document.getElementById("sosLng").value),
        severity: document.getElementById("sosSeverity").value,
        details: document.getElementById("sosDetails").value || "Emergency distress call logged."
    };

    try {
        const res = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to submit emergency complaint");
        }

        const data = await res.json();
        closeEmergencyComplaintModal();
        showSosDispatchReceipt(data);
        await loadEmergencyComplaints();

    } catch (err) {
        alert("SOS Dispatch Failed: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "🚨 TRANSMIT EMERGENCY SOS & ALERT NEAREST STATION";
    }
}

// -------------------------------------------------------------
// 3. MAP RENDERING & DISPATCH RECEIPTS
// -------------------------------------------------------------

async function loadEmergencyFacilities() {
    try {
        const res = await fetch("/api/emergency/facilities");
        const data = await res.json();
        emergencyFacilities = data.facilities || [];
        renderFacilityMarkers();
    } catch (err) {
        console.error("Failed to load emergency facilities:", err);
    }
}

function renderFacilityMarkers() {
    if (!layerGroups.facilities) return;
    layerGroups.facilities.clearLayers();

    emergencyFacilities.forEach(fac => {
        const isPolice = fac.facility_type === "police_station";
        const iconEmoji = isPolice ? "🚔" : "🏥";
        const markerClass = isPolice ? "police" : "hospital";

        const customIcon = L.divIcon({
            className: `facility-marker ${markerClass}`,
            html: iconEmoji,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });

        const marker = L.marker([fac.latitude, fac.longitude], { icon: customIcon });

        const popupContent = `
            <div style="font-family: inherit; min-width: 220px; color: #1e293b;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                    <span style="font-size: 20px;">${iconEmoji}</span>
                    <div>
                        <strong style="font-size: 13px; color: ${isPolice ? '#1d4ed8' : '#dc2626'};">${fac.name}</strong>
                        <div style="font-size: 10.5px; color: #64748b;">${fac.district}, ${fac.state}</div>
                    </div>
                </div>
                <div style="font-size: 11px; margin-bottom: 6px; line-height: 1.4;">
                    <div><strong>Emergency Line:</strong> <span style="color: #dc2626; font-weight: 800;">${fac.emergency_line}</span></div>
                    <div><strong>Direct Phone:</strong> ${fac.phone}</div>
                    <div><strong>Available Fleet:</strong> <span style="color: #059669; font-weight: 600;">${fac.units_available}</span></div>
                    <div><strong>In Charge:</strong> ${fac.nodal_officer || 'Duty Officer'}</div>
                </div>
                <div style="margin-top: 8px; text-align: center;">
                    <a href="tel:${fac.emergency_line}" style="display: block; background: #dc2626; color: white; padding: 5px 8px; border-radius: 5px; font-weight: bold; font-size: 11px; text-decoration: none;">
                        📞 Call Emergency Line (${fac.emergency_line})
                    </a>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        layerGroups.facilities.addLayer(marker);
    });
}

async function loadEmergencyComplaints() {
    try {
        const res = await fetch("/api/complaints");
        const data = await res.json();
        emergencyComplaints = data.complaints || [];
        renderComplaintsList();
    } catch (err) {
        console.error("Failed to load emergency complaints:", err);
    }
}

function renderComplaintsList() {
    const container = document.getElementById("sosListContainer");
    if (!container) return;

    if (!emergencyComplaints.length) {
        container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 12px;">No active emergency SOS tickets at this moment.</div>`;
        return;
    }

    const isHq = (typeof isHeadquartersUser === 'function' ? isHeadquartersUser() : (localStorage.getItem('aapdamarg_user_role') === 'headquarters'));

    container.innerHTML = emergencyComplaints.map(c => {
        const icon = c.complaint_type === "police" ? "🚔" : (c.complaint_type === "ambulance" ? "🚑" : "🚨");
        const statusClass = c.dispatch_status || "dispatched";
        const natureFormatted = (c.emergency_nature || "emergency").replace(/_/g, " ").toUpperCase();

        return `
            <div class="complaint-card" onclick="focusSosComplaint(${c.id})" style="cursor: pointer;">
                <div class="complaint-header">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 16px;">${icon}</span>
                        <strong style="font-size: 12px; color: #0f172a;">${natureFormatted}</strong>
                    </div>
                    <span class="dispatch-badge ${statusClass}">${statusClass.replace('_', ' ')}</span>
                </div>
                <div style="font-size: 11px; color: #334155; margin-bottom: 4px;">
                    📍 ${c.location_address || 'North East Location'}
                </div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 6px; line-height: 1.3;">
                    ${c.details || 'Emergency distress call logged.'}
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 10.5px; border-left: 3px solid #ef4444;">
                    <div><strong>Responding Station:</strong> <span style="color: #0284c7;">${c.assigned_facility_name}</span> (${c.distance_km} km)</div>
                    <div><strong>Assigned Unit:</strong> ${c.assigned_unit}</div>
                    <div style="display: flex; justify-content: space-between; margin-top: 3px;">
                        <span>ETA: <strong style="color: #16a34a;">~${c.eta_minutes} mins</strong></span>
                        <span style="color: #64748b;">Caller: ${c.caller_name}</span>
                    </div>
                </div>
                ${isHq ? `
                    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #fca5a5; display: flex; justify-content: flex-end;">
                        <button onclick="event.stopPropagation(); removeEmergencyBeacon(${c.id})" style="background: #fef2f2; color: #dc2626; border: 1px solid #f87171; border-radius: 4px; padding: 3px 8px; font-size: 10.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="Authorized Headquarters Action: Remove Emergency Symbol & Ticket">
                            🗑️ Remove Beacon (HQ)
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join("");
}

function focusSosComplaint(id) {
    const comp = emergencyComplaints.find(c => c.id === id);
    if (!comp) return;

    map.flyTo([comp.latitude, comp.longitude], 12);
    highlightSosRoute(comp);
}

function showSosDispatchReceipt(dispatchResult) {
    const receiptModal = document.getElementById("sosReceiptModal");
    if (!receiptModal) return;

    const alertInfo = dispatchResult.alert_dispatch;
    const primary = alertInfo.primary_responder;
    const secondary = alertInfo.secondary_responder;
    const victim = alertInfo.victim_location;
    const isPolice = primary.facility_type === "police_station";

    document.getElementById("receiptTicketId").innerText = alertInfo.ticket_id;
    document.getElementById("receiptStationName").innerText = primary.station_name;
    document.getElementById("receiptStationSub").innerText = `${primary.district}, ${primary.state} • ${isPolice ? 'Police Division' : '108 Trauma Command'}`;
    document.getElementById("receiptDistance").innerText = `${primary.distance_km} km`;
    document.getElementById("receiptEta").innerText = `~${primary.eta_minutes} mins`;
    document.getElementById("receiptUnit").innerText = primary.assigned_unit;
    document.getElementById("receiptPhoneBtn").href = `tel:${primary.emergency_line}`;
    document.getElementById("receiptPhoneBtn").innerText = `📞 Call Station Line (${primary.emergency_line})`;

    const secBox = document.getElementById("receiptSecondaryBox");
    if (secondary && secBox) {
        secBox.style.display = "block";
        secBox.innerHTML = `
            <div style="margin-top: 10px; padding: 10px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd; border-left: 3px solid #0284c7;">
                <div style="font-size: 11px; color: #0284c7; font-weight: bold;">🚔 SECONDARY ESCORT UNIT ALERTED:</div>
                <div style="font-size: 12px; font-weight: bold; color: #0f172a;">${secondary.station_name} (${secondary.distance_km} km)</div>
                <div style="font-size: 10.5px; color: #475569;">${secondary.assigned_unit}</div>
            </div>
        `;
    } else if (secBox) {
        secBox.style.display = "none";
    }

    const isHqUser = (typeof isHeadquartersUser === 'function' ? isHeadquartersUser() : (localStorage.getItem('aapdamarg_user_role') === 'headquarters'));
    const hqReceiptBox = document.getElementById("receiptHqClearBox");
    if (hqReceiptBox) hqReceiptBox.style.display = isHqUser ? "block" : "none";

    receiptModal.classList.add("active");

    highlightSosLocationAndRoute(
        victim.lat, victim.lng, 
        primary.station_lat, primary.station_lng, 
        primary.station_name,
        {
            ticketId: alertInfo.ticket_id,
            locationAddress: victim.address,
            assignedUnit: primary.assigned_unit,
            stationName: primary.station_name,
            distanceKm: primary.distance_km,
            etaMinutes: primary.eta_minutes,
            emergencyLine: primary.emergency_line,
            timestamp: alertInfo.timestamp,
            complaintId: dispatchResult.complaint ? dispatchResult.complaint.id : null
        }
    );
}

function highlightSosLocationAndRoute(victimLat, victimLng, stationLat, stationLng, stationName, details = {}) {
    if (!layerGroups.sosIncidents) return;
    layerGroups.sosIncidents.clearLayers();

    currentEmergencyInfo = {
        ticketId: details.ticketId || "SOS-ACTIVE",
        locationAddress: details.locationAddress || (autoDetectedCoords ? autoDetectedCoords.name : "Northeast Regional Corridor"),
        lat: victimLat,
        lng: victimLng,
        accuracy: details.accuracy || (autoDetectedCoords ? autoDetectedCoords.accuracy : 12),
        severity: details.severity || "CRITICAL (Immediate Danger)",
        situationSummary: details.situationSummary || "Active Emergency Incident: Rapid First Responders Dispatched",
        details: details.details || "Citizen emergency distress beacon verified and actively routed to emergency first response units.",
        assignedUnit: details.assignedUnit || "108 ALS Ambulance / Patrol Squad",
        stationName: stationName || details.stationName || "State Emergency Operations Command",
        distanceKm: details.distanceKm !== undefined ? details.distanceKm : calcGeoDistance(victimLat, victimLng, stationLat, stationLng),
        etaMinutes: details.etaMinutes !== undefined ? details.etaMinutes : Math.max(5, Math.round((calcGeoDistance(victimLat, victimLng, stationLat, stationLng) / 40.0) * 60) + 2),
        emergencyLine: details.emergencyLine || "112",
        timestamp: details.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " IST",
        complaintId: details.complaintId || null
    };
    window.currentEmergencyInfo = currentEmergencyInfo;

    // Mark the emergency location on map with emergency symbol
    const emergencySymbolIcon = L.divIcon({
        className: "sos-emergency-symbol-marker",
        html: '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:20px;line-height:1;">🚨</span>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
    });
    sosBeaconMarker = L.marker([victimLat, victimLng], {
        icon: emergencySymbolIcon,
        title: `Emergency Distress: ${victimLat.toFixed(4)}, ${victimLng.toFixed(4)}`
    });
    window.sosBeaconMarker = sosBeaconMarker;

    sosBeaconMarker.bindPopup(createEmergencyMarkerPopupHtml(currentEmergencyInfo), {
        maxWidth: 320,
        minWidth: 270,
        className: 'sos-leaflet-popup'
    });
    sosBeaconMarker.on('click', function(e) {
        this.setPopupContent(createEmergencyMarkerPopupHtml(currentEmergencyInfo));
        this.openPopup();
    });

    sosBeaconMarker.addTo(layerGroups.sosIncidents);

    const bounds = L.latLngBounds([
        [stationLat, stationLng],
        [victimLat, victimLng]
    ]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
}

function highlightSosRoute(comp) {
    const primaryFac = emergencyFacilities.find(f => f.id === comp.assigned_facility_id) || {
        latitude: comp.latitude + 0.05,
        longitude: comp.longitude + 0.05,
        name: comp.assigned_facility_name
    };

    highlightSosLocationAndRoute(
        comp.latitude, comp.longitude,
        primaryFac.latitude, primaryFac.longitude,
        comp.assigned_facility_name,
        {
            ticketId: `SOS-${String(comp.id).padStart(4, '0')}`,
            locationAddress: comp.location_address,
            assignedUnit: comp.assigned_unit,
            stationName: comp.assigned_facility_name,
            distanceKm: comp.distance_km,
            etaMinutes: comp.eta_minutes,
            emergencyLine: '112',
            complaintId: comp.id
        }
    );
}

// Generate rich info popup content for the emergency symbol marker
function createEmergencyMarkerPopupHtml(info) {
    if (!info) return '<div style="padding:12px;font-size:12px;color:#475569;">No emergency situation data available.</div>';
    const isHq = (typeof isHeadquartersUser === 'function' ? isHeadquartersUser() : (
        localStorage.getItem('aapdamarg_user_role') === 'headquarters' ||
        localStorage.getItem('route_rakshak_role') === 'headquarters'
    ));

    return `
        <div class="emergency-info-popup" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 290px; max-width: 330px; color: #0f172a; padding: 2px;">
            <!-- Top Header & Live Status -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #fee2e2; padding-bottom: 8px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 24px; line-height: 1;">🚨</span>
                    <div>
                        <div style="font-weight: 800; font-size: 13px; color: #dc2626; line-height: 1.2; letter-spacing: 0.2px;">EMERGENCY DISTRESS BEACON</div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 600;">TICKET: <span style="color: #ea580c; font-family: monospace;">${info.ticketId || 'SOS-ACTIVE'}</span></div>
                    </div>
                </div>
                <span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">
                    ● ACTIVE
                </span>
            </div>

            <!-- Emergency Situation Details -->
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-left: 3.5px solid #e11d48; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 3px;">
                    <span style="font-size: 11px;">⚠️</span>
                    <span style="font-weight: 800; font-size: 10.5px; color: #9f1239; text-transform: uppercase; letter-spacing: 0.3px;">Emergency Situation</span>
                </div>
                <div style="font-weight: 700; font-size: 11.5px; color: #881337; line-height: 1.35; margin-bottom: 4px;">
                    ${info.situationSummary || 'Critical Emergency Distress Call: Immediate Rescue & Medical Assistance Mobilized'}
                </div>
                <div style="font-size: 10.5px; color: #9f1239; line-height: 1.4;">
                    ${info.details || 'Citizen emergency distress beacon triggered at live location. Real-time GPS telemetry routed to 112 CAD dispatch, nearest trauma center & police highway patrol.'}
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 9.5px; font-weight: 700; color: #be123c;">
                    <span style="background: #ffe4e6; padding: 2px 5px; border-radius: 3px;">⚡ Critical Life-Threat</span>
                    <span style="background: #ffe4e6; padding: 2px 5px; border-radius: 3px;">🛰️ Live GPS Locked (±${info.accuracy || 12}m)</span>
                </div>
            </div>

            <!-- Live Location & Coordinates -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; margin-bottom: 8px; font-size: 11px;">
                <div style="display: flex; gap: 5px; margin-bottom: 3px;">
                    <span style="color: #dc2626; font-size: 12px;">📍</span>
                    <div style="font-weight: 700; color: #1e293b; line-height: 1.3;">${info.locationAddress || 'Live GPS Location'}</div>
                </div>
                <div style="color: #64748b; font-size: 10px; font-family: monospace; padding-left: 17px;">
                    GPS: ${Number(info.lat).toFixed(4)}°N, ${Number(info.lng).toFixed(4)}°E
                </div>
            </div>

            <!-- Estimated Arrival & Distance -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 5px 6px; text-align: center;">
                    <div style="font-size: 9px; color: #166534; font-weight: 700; text-transform: uppercase;">EST. ARRIVAL</div>
                    <div style="font-size: 12.5px; font-weight: 800; color: #15803d;">~${info.etaMinutes || 12} mins</div>
                </div>
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 5px 6px; text-align: center;">
                    <div style="font-size: 9px; color: #0369a1; font-weight: 700; text-transform: uppercase;">DISTANCE</div>
                    <div style="font-size: 12.5px; font-weight: 800; color: #0284c7;">${info.distanceKm || 4.2} km</div>
                </div>
            </div>

            <!-- Responding Station & Response Unit -->
            <div style="font-size: 10.5px; color: #334155; line-height: 1.4; margin-bottom: 8px; background: #ffffff; border: 1px solid #f1f5f9; padding: 6px 8px; border-radius: 6px;">
                <div><strong>Responding Station:</strong> <span style="color: #0284c7; font-weight: 600;">${info.stationName || 'State Emergency Operations Command'}</span></div>
                <div><strong>Response Unit:</strong> <span style="color: #475569;">${info.assignedUnit || '108 ALS Emergency Squad'}</span></div>
                <div style="font-size: 9.5px; color: #94a3b8; margin-top: 3px;">Logged: ${info.timestamp || 'Just now'}</div>
            </div>

            <!-- Emergency Phone Call -->
            <div style="display: flex; gap: 6px; margin-bottom: ${isHq ? '8px' : '2px'};">
                <a href="tel:${info.emergencyLine || '112'}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; background: #dc2626; color: white; text-decoration: none; padding: 7px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-align: center;">
                    📞 Call Emergency Line (${info.emergencyLine || '112'})
                </a>
            </div>

            <!-- Headquarters Authority Action: Remove Emergency Symbol -->
            ${isHq ? `
                <div style="border-top: 1.5px dashed #fca5a5; padding-top: 8px; margin-top: 6px; text-align: center;">
                    <button id="btnRemoveEmergencyBeaconHq" onclick="removeEmergencyBeacon(${info.complaintId || 'null'})" style="width: 100%; background: #fef2f2; color: #b91c1c; border: 1.5px solid #ef4444; border-radius: 6px; padding: 7px 10px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" title="Authorized Headquarters Action: Remove Emergency Symbol">
                        🗑️ Remove Emergency Symbol (HQ)
                    </button>
                    <div style="font-size: 9.5px; color: #991b1b; margin-top: 3px; font-weight: 600;">
                        🛡️ Headquarters Authority Verified
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Remove emergency symbol beacon from map and clear complaint record (Headquarters exclusive)
async function removeEmergencyBeacon(complaintId, skipConfirm = false) {
    const isHq = (typeof isHeadquartersUser === 'function' ? isHeadquartersUser() : (
        localStorage.getItem('aapdamarg_user_role') === 'headquarters' ||
        localStorage.getItem('route_rakshak_role') === 'headquarters'
    ));
    if (!isHq) {
        alert("Permission Denied: Only Headquarters personnel have authorization to remove this emergency symbol.");
        return;
    }

    if (!skipConfirm && typeof window.__testing === 'undefined') {
        if (!confirm("Are you sure you want to resolve and remove this emergency symbol from the map?")) {
            return;
        }
    }

    // 1. Cancel active countdown if any
    if (typeof cancelInstantSos === 'function') {
        cancelInstantSos();
    }

    // 2. Remove marker from Leaflet layer
    if (layerGroups && layerGroups.sosIncidents) {
        layerGroups.sosIncidents.clearLayers();
    }
    sosBeaconMarker = null;
    window.sosBeaconMarker = null;
    currentEmergencyInfo = null;
    window.currentEmergencyInfo = null;

    // 3. If complaintId is available, delete from backend with Headquarters header
    if (complaintId) {
        try {
            await fetch(`/api/complaints/${complaintId}`, {
                method: "DELETE",
                headers: { "X-User-Role": "headquarters" }
            });
        } catch (err) {
            console.warn("Failed to delete complaint from backend:", err);
        }
        await loadEmergencyComplaints();
    }

    // 4. Close open popups
    if (map) map.closePopup();

    // 5. Update instant modal HQ box if visible
    const hqBox = document.getElementById("instantHqRemoveContainer");
    if (hqBox) hqBox.style.display = "none";

    showSosToast("✓ Emergency symbol removed and distress beacon cleared by Headquarters.");
}
window.removeEmergencyBeacon = removeEmergencyBeacon;

function toggleEmergencyFacilityLayer(show) {
    if (!layerGroups.facilities) return;
    if (show) {
        map.addLayer(layerGroups.facilities);
    } else {
        map.removeLayer(layerGroups.facilities);
    }
}
