// AapdaMarg NE - Field Official & Authority SITREP Controller

function openSitrepModal() {
    document.getElementById('sitrepModal').classList.add('active');
    if (!document.getElementById('sitrepLat').value) {
        document.getElementById('sitrepLat').value = "25.1090";
        document.getElementById('sitrepLng').value = "92.3620";
    }
}

function closeSitrepModal() {
    document.getElementById('sitrepModal').classList.remove('active');
}

async function submitFieldSitrep(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitSitrep');
    btn.innerHTML = 'Broadcasting Official SITREP...';
    btn.disabled = true;

    const form = document.getElementById('sitrepForm');
    const formData = new FormData(form);

    try {
        const res = await fetch('/api/sitreps', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            throw new Error("Failed to submit field SITREP");
        }

        const data = await res.json();
        alert(`SITREP Logged: ${data.message}`);
        closeSitrepModal();
        form.reset();

        // Refresh hazards, alerts, and fleet status
        await loadHazardsAndZones();
        await loadFleetTracking();
        await loadLogisticsAlerts();

    } catch (err) {
        alert("SITREP Submission Error: " + err.message);
    } finally {
        btn.innerHTML = '🛡️ Broadcast Verified Situation Report';
        btn.disabled = false;
    }
}

async function loadSitrepsList() {
    const container = document.getElementById('sitrepListContainer');
    if (!container) return;

    try {
        const res = await fetch('/api/sitreps');
        const data = await res.json();

        if (!data.sitreps || data.sitreps.length === 0) {
            container.innerHTML = '<div class="p-3 text-gray-400">No field SITREPs logged today.</div>';
            return;
        }

        container.innerHTML = data.sitreps.map(s => {
            const dateStr = new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return `
                <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; margin-bottom: 8px; border-left: 4px solid #38bdf8;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 800; background: #0284c7; color: white; padding: 2px 6px; border-radius: 3px;">
                            ${s.agency} VERIFIED
                        </span>
                        <span style="font-size: 10px; color: #94a3b8;">${dateStr}</span>
                    </div>
                    <strong style="font-size: 12px; color: #f8fafc;">${s.corridor} (${s.district})</strong>
                    <div style="font-size: 11px; color: #cbd5e1; margin: 4px 0;">
                        <div>Officer: <strong>${s.officer_name} (${s.officer_rank})</strong></div>
                        <div>Clearance Progress: <strong>${s.clearance_pct}%</strong> • Status: <strong style="color: ${s.passability === 'closed' ? '#ef4444' : '#f59e0b'};">${s.passability.toUpperCase()}</strong></div>
                        <div>Bridge Condition: <strong>${s.bridge_status.toUpperCase()}</strong></div>
                    </div>
                    <p style="font-size: 10.5px; color: #94a3b8; font-style: italic; margin-top: 4px;">"${s.notes}"</p>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading SITREPs:", err);
    }
}
