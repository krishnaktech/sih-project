// AapdaMarg NE - Master Application Controller

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Map
    initMap();

    // 2. Initialize Routing Cities & Defaults
    await initRouting();

    // 3. Initialize Weather Feed & Ticker
    await initWeather();

    // 4. Initialize Reporting Subsystem & Feed
    initReporting();

    // 5. Run default route calculation (Guwahati to Silchar)
    calculateRoute();

    // 6. Initialize Real-Time GPS Subsystem
    initGpsSubsystem();

    // 7. Initialize Amenities & Essential Fleet Tracking
    await initFleetAndAmenities();

    // 8. Load Field Official SITREPs
    loadSitrepsList();

    // 9. Initialize Emergency Complaint & SOS Dispatch Subsystem
    await initSosSubsystem();

    // 10. Setup Event Listeners
    setupEventListeners();

    // 11. Initialize Role & Multi-Persona Subsystem
    initRoleSubsystem();

    // 12. Check URL hash for direct tab navigation on mobile
    if (window.location.hash) {
        const hash = window.location.hash.replace('#', '');
        if (['tabRoute', 'tabFleet', 'tabSos', 'tabWeather', 'tabFeed', 'tabSitrep'].includes(hash)) {
            if (window.innerWidth <= 768) {
                switchMobileView(hash);
            }
        }
    }
});

function setupEventListeners() {
    // Tab switching in sidebar
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchSidebarTab(tab.dataset.tab);
        });
    });

    // Form submission
    const form = document.getElementById('hazardReportForm');
    if (form) {
        form.addEventListener('submit', submitHazardReport);
    }
}

// Emergency Contacts & Shelters Modal
async function openEmergencyModal() {
    const modal = document.getElementById('emergencyModal');
    modal.classList.add('active');

    try {
        const res = await fetch('/api/emergency');
        const data = await res.json();

        // Helplines
        const contactList = document.getElementById('emergencyContactsList');
        contactList.innerHTML = data.emergency_contacts.map(c => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div>
                    <strong style="color: #0f172a; font-size: 13px;">${c.agency}</strong>
                    <div style="font-size: 11px; color: #64748b;">${c.region} • <span style="color: #0284c7;">${c.category}</span></div>
                </div>
                <div style="text-align: right;">
                    <a href="tel:${c.phone.split('/')[0].trim()}" style="background: #dc2626; color: white; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; text-decoration: none; display: inline-block;">
                        📞 Call ${c.phone}
                    </a>
                </div>
            </div>
        `).join('');

        // Relief Camps
        const campList = document.getElementById('reliefCampsList');
        campList.innerHTML = data.relief_camps.map(camp => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #15803d; font-size: 13px;">🏥 ${camp.name}</strong>
                    <span style="font-size: 11px; color: #64748b;">${camp.district}, ${camp.state}</span>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 11px; color: #334155;">
                    <span>Occupancy: <strong>${camp.current_occupancy} / ${camp.capacity}</strong></span>
                    <span>Medical: <strong>${camp.medical_available ? '✅ Available' : '❌ Limited'}</strong></span>
                    <span>Food/Water: <strong>${camp.food_water_available ? '✅ Stocked' : '❌ Low'}</strong></span>
                </div>
                <div style="margin-top: 6px; font-size: 11px; color: #64748b;">
                    In Charge: <strong>${camp.in_charge}</strong> | 📞 ${camp.contact_phone}
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error("Failed to load emergency data:", err);
    }
}

function closeEmergencyModal() {
    document.getElementById('emergencyModal').classList.remove('active');
}

// Reset Demo Data
async function resetDemoData() {
    if (confirm("Reset disaster incidents and weather back to standard North East baseline scenario?")) {
        try {
            await fetch('/api/reset-data', { method: 'POST' });
            alert("Database reloaded with realistic baseline scenario.");
            location.reload();
        } catch (err) {
            alert("Failed to reset: " + err);
        }
    }
}

// Sidebar Tab Navigation Controller (with History / Back Support)
function switchSidebarTab(targetTab = 'tabRoute') {
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(t => {
        if (t.dataset.tab === targetTab) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const activeContent = document.getElementById(targetTab);
    if (activeContent) {
        activeContent.style.display = 'flex';
    }

    // Scroll sidebar drawer back to top
    const sidebar = document.getElementById('sidebarDrawer');
    if (sidebar) sidebar.scrollTop = 0;

    // Toggle Mobile Drawer Back Button visibility
    const btnMobileBack = document.getElementById('btnMobileDrawerBack');
    if (btnMobileBack) {
        btnMobileBack.style.display = (targetTab === 'tabRoute') ? 'none' : 'inline-flex';
    }

    // If mobile view is active, keep mobile drawer and bottom nav in sync
    if (window.innerWidth <= 768 && typeof switchMobileView === 'function') {
        switchMobileView(targetTab);
    }
}

// Mobile View Switching & Drawer Controls
function switchMobileView(targetTab) {
    const sidebar = document.getElementById('sidebarDrawer');
    const backdrop = document.getElementById('mobileDrawerBackdrop');
    
    // Update bottom nav items active state
    document.querySelectorAll('.m-nav-item').forEach(btn => btn.classList.remove('active'));
    
    if (targetTab === 'map') {
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.remove('active');
        const mNavMap = document.getElementById('mNavMap');
        if (mNavMap) mNavMap.classList.add('active');
        if (window.map) {
            setTimeout(() => window.map.invalidateSize(), 200);
        }
        return;
    }

    // Open drawer
    if (sidebar) sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('active');

    // Update mobile back button
    const btnMobileBack = document.getElementById('btnMobileDrawerBack');
    if (btnMobileBack) {
        btnMobileBack.style.display = (targetTab === 'tabRoute') ? 'none' : 'inline-flex';
    }

    // Highlight bottom nav button
    if (targetTab === 'tabRoute') {
        const btn = document.getElementById('mNavRoute');
        if (btn) btn.classList.add('active');
        const title = document.getElementById('drawerTitleText');
        if (title) title.innerText = '🧭 Safe Route Navigator';
    } else if (targetTab === 'tabFleet') {
        const btn = document.getElementById('mNavFleet');
        if (btn) btn.classList.add('active');
        const title = document.getElementById('drawerTitleText');
        if (title) title.innerText = '🚚 Supply Fleet Tracking';
    } else if (targetTab === 'tabSos') {
        const title = document.getElementById('drawerTitleText');
        if (title) title.innerText = '🚨 Emergency SOS Dispatch';
    } else if (targetTab === 'tabWeather') {
        const title = document.getElementById('drawerTitleText');
        if (title) title.innerText = '🌧️ Weather & Flood Telemetry';
    } else if (targetTab === 'tabFeed') {
        const title = document.getElementById('drawerTitleText');
        if (title) title.innerText = '📢 Citizen Incident Feed';
    } else if (targetTab === 'tabSitrep') {
        const title = document.getElementById('drawerTitleText');
        if (title) title.innerText = '📋 Authority SITREPs';
    }

    // Switch sidebar tab
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(t => {
        if (t.dataset.tab === targetTab) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const activeContent = document.getElementById(targetTab);
    if (activeContent) activeContent.style.display = 'flex';
}

function closeMobileDrawer() {
    const sidebar = document.getElementById('sidebarDrawer');
    const backdrop = document.getElementById('mobileDrawerBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
    
    document.querySelectorAll('.m-nav-item').forEach(btn => btn.classList.remove('active'));
    const mNavMap = document.getElementById('mNavMap');
    if (mNavMap) mNavMap.classList.add('active');

    if (window.map) {
        setTimeout(() => window.map.invalidateSize(), 200);
    }
}

function openMobileMenuModal() {
    const m = document.getElementById('mobileMenuModal');
    if (m) {
        m.classList.add('active');
        m.style.display = 'flex';
        m.style.opacity = '1';
        m.style.pointerEvents = 'auto';
        m.style.visibility = 'visible';
    }
}

function closeMobileMenuModal(e) {
    if (e && e.target && e.target.closest && e.target.closest('.mobile-menu-sheet') && !e.target.classList.contains('modal-close')) {
        return;
    }
    const m = document.getElementById('mobileMenuModal');
    if (m) {
        m.classList.remove('active');
        m.style.display = 'none';
        m.style.opacity = '0';
        m.style.pointerEvents = 'none';
    }
}

