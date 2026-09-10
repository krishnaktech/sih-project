// AapdaMarg NE - Emergency Complaint & Automated SOS Dispatch Controller

let emergencyFacilities = [];
let emergencyComplaints = [];
let sosBeaconMarker = null;
let sosDispatchRouteLine = null;
let currentServiceType = "ambulance"; // 'police', 'ambulance', 'both'
let pickingSosLocation = false;

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

// -------------------------------------------------------------
// 1. AUTOMATIC LOCATION ACCESS & 1-TOUCH INSTANT SOS DISPATCH
// -------------------------------------------------------------

async function triggerInstantAutoSos() {
    const modal = document.getElementById("instantSosModal");
    if (!modal) return;
    modal.classList.add("active");

    playEmergencyTone(false);

    // Reset UI
    instantCountdownSeconds = 4;
    document.getElementById("instantCountdownNum").innerText = instantCountdownSeconds;
    document.getElementById("instantGpsStatusText").innerText = "Accessing Live GPS Satellite Telemetry...";
    document.getElementById("instantGpsBadge").style.display = "none";
    document.getElementById("instantStationGrid").style.display = "none";
    document.getElementById("btnInstantSendNow").innerText = "⚡ TRANSMIT ALERT NOW (1-CLICK)";
    document.getElementById("btnInstantSendNow").disabled = false;

    // 1. Immediately access location
    acquireLiveLocation((coords) => {
        autoDetectedCoords = coords;
        document.getElementById("instantGpsCoords").innerText = `${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`;
        document.getElementById("instantGpsBadge").style.display = "inline-flex";
        document.getElementById("instantGpsStatusText").innerText = "✓ High-Accuracy GPS Signal Locked!";

        // Find nearest facilities locally for instant preview
        let nearestHosp = null, minHospDist = Infinity;
        let nearestPol = null, minPolDist = Infinity;

        emergencyFacilities.forEach(f => {
            const dist = calcGeoDistance(coords.lat, coords.lng, f.latitude, f.longitude);
            if (f.facility_type === "hospital_ambulance" && dist < minHospDist) {
                minHospDist = dist;
                nearestHosp = f;
            } else if (f.facility_type === "police_station" && dist < minPolDist) {
                minPolDist = dist;
                nearestPol = f;
            }
        });

        if (nearestHosp) {
            document.getElementById("instantNearHospital").innerText = nearestHosp.name;
            const eta = Math.max(5, Math.round((minHospDist / 40.0) * 60) + 2);
            document.getElementById("instantNearHospitalDist").innerText = `${minHospDist} km (ETA ~${eta} mins)`;
        }
        if (nearestPol) {
            document.getElementById("instantNearPolice").innerText = nearestPol.name;
            document.getElementById("instantNearPoliceDist").innerText = `${minPolDist} km`;
        }

        document.getElementById("instantStationGrid").style.display = "grid";
    });

    // 2. Start automated countdown to send alert
    if (instantCountdownTimer) clearInterval(instantCountdownTimer);
    instantCountdownTimer = setInterval(() => {
        instantCountdownSeconds--;
        if (instantCountdownSeconds >= 0) {
            document.getElementById("instantCountdownNum").innerText = instantCountdownSeconds;
            playEmergencyTone(false);
        }

        if (instantCountdownSeconds <= 0) {
            clearInterval(instantCountdownTimer);
            executeAutoSosDispatchNow();
        }
    }, 1000);
}

// Acquire Live GPS coordinates with fallback
function acquireLiveLocation(callback) {
    if (window.currentGpsPos) {
        callback(window.currentGpsPos);
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                callback({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => {
                console.warn("GPS access timeout or permission denied, using map center fallback:", err);
                const center = map.getCenter();
                callback({ lat: center.lat, lng: center.lng });
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
        );
    } else {
        const center = map.getCenter();
        callback({ lat: center.lat, lng: center.lng });
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

    const coords = autoDetectedCoords || (window.currentGpsPos ? window.currentGpsPos : map.getCenter());

    const payload = {
        complaint_type: "both",
        emergency_nature: "immediate_danger",
        caller_name: "Emergency Citizen (Auto-GPS)",
        caller_phone: "Auto-Distress Telemetry (112)",
        location_address: `Live GPS Satellite Coordinates (${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E)`,
        latitude: coords.lat,
        longitude: coords.lng,
        severity: "critical",
        details: "Automated Emergency SOS broadcast triggered. Geolocation automatically accessed."
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
        showSosDispatchReceipt(data);
        await loadEmergencyComplaints();

    } catch (err) {
        alert("Emergency SOS Failed: " + err.message);
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

function openEmergencyComplaintModal() {
    const modal = document.getElementById("sosComplaintModal");
    if (modal) modal.classList.add("active");

    // Automatically detect GPS location in background
    acquireLiveLocation((coords) => {
        document.getElementById("sosLat").value = coords.lat.toFixed(5);
        document.getElementById("sosLng").value = coords.lng.toFixed(5);
        const addrField = document.getElementById("sosAddress");
        if (!addrField.value) {
            addrField.value = `Auto-Detected GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
        }
    });
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

function useSosLiveGps() {
    acquireLiveLocation((coords) => {
        document.getElementById("sosLat").value = coords.lat.toFixed(5);
        document.getElementById("sosLng").value = coords.lng.toFixed(5);
        alert(`✓ Live GPS Coordinates locked: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    });
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

    receiptModal.classList.add("active");

    highlightSosLocationAndRoute(victim.lat, victim.lng, primary.station_lat, primary.station_lng, primary.station_name);
}

function highlightSosLocationAndRoute(victimLat, victimLng, stationLat, stationLng, stationName) {
    if (!layerGroups.sosIncidents) return;
    layerGroups.sosIncidents.clearLayers();

    const sosIcon = L.divIcon({
        className: "sos-beacon-marker",
        html: "🆘",
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    sosBeaconMarker = L.marker([victimLat, victimLng], { icon: sosIcon })
        .bindPopup(`<strong style="color: #dc2626;">🚨 ACTIVE EMERGENCY SOS SCENE</strong><br>Responding: <b>${stationName}</b>`)
        .addTo(layerGroups.sosIncidents);

    const routeCoords = [
        [stationLat, stationLng],
        [victimLat, victimLng]
    ];

    sosDispatchRouteLine = L.polyline(routeCoords, {
        color: "#ef4444",
        weight: 4,
        dashArray: "8, 8",
        opacity: 0.9
    }).addTo(layerGroups.sosIncidents);

    const bounds = L.latLngBounds([
        [stationLat, stationLng],
        [victimLat, victimLng]
    ]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    sosBeaconMarker.openPopup();
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
        comp.assigned_facility_name
    );
}

function toggleEmergencyFacilityLayer(show) {
    if (!layerGroups.facilities) return;
    if (show) {
        map.addLayer(layerGroups.facilities);
    } else {
        map.removeLayer(layerGroups.facilities);
    }
}
