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
});

function setupEventListeners() {
    // Tab switching in sidebar
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const activeContent = document.getElementById(target);
            if (activeContent) activeContent.style.display = 'flex';
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
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #f8fafc; font-size: 13px;">${c.agency}</strong>
                    <div style="font-size: 11px; color: #94a3b8;">${c.region} • <span style="color: #38bdf8;">${c.category}</span></div>
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
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #34d399; font-size: 13px;">🏥 ${camp.name}</strong>
                    <span style="font-size: 11px; color: #94a3b8;">${camp.district}, ${camp.state}</span>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 11px; color: #cbd5e1;">
                    <span>Occupancy: <strong>${camp.current_occupancy} / ${camp.capacity}</strong></span>
                    <span>Medical: <strong>${camp.medical_available ? '✅ Available' : '❌ Limited'}</strong></span>
                    <span>Food/Water: <strong>${camp.food_water_available ? '✅ Stocked' : '❌ Low'}</strong></span>
                </div>
                <div style="margin-top: 6px; font-size: 11px; color: #94a3b8;">
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
