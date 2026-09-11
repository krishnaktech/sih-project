// AapdaMarg NE - Field Official & Authority SITREP Controller

function openSitrepModal() {
    const modal = document.getElementById('sitrepModal');
    if (modal) modal.classList.add('active');

    // Sync active officer deployment profile into SITREP modal
    if (typeof updateOfficerUI === 'function') {
        updateOfficerUI();
    }

    setupSitrepPhotoPreview();

    if (!document.getElementById('sitrepLat').value) {
        document.getElementById('sitrepLat').value = "25.1090";
        document.getElementById('sitrepLng').value = "92.3620";
    }
}

function closeSitrepModal() {
    document.getElementById('sitrepModal').classList.remove('active');
}

// Photo preview handlers for SITREP form
function setupSitrepPhotoPreview() {
    const fileInput = document.getElementById('sitrepPhotoInput');
    const dropZone = document.getElementById('sitrepPhotoDropZone');
    const previewContainer = document.getElementById('sitrepPhotoPreviewContainer');
    const previewImg = document.getElementById('sitrepPhotoPreviewImg');

    if (!fileInput || !dropZone || dropZone.dataset.bound === 'true') return;
    dropZone.dataset.bound = 'true';

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            displaySitrepPreview(file);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#0284c7';
        dropZone.style.background = '#f0f9ff';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(2, 132, 199, 0.4)';
        dropZone.style.background = '#f8fafc';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(2, 132, 199, 0.4)';
        dropZone.style.background = '#f8fafc';
        if (e.dataTransfer.files && e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            displaySitrepPreview(e.dataTransfer.files[0]);
        }
    });

    function displaySitrepPreview(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            if (previewImg) previewImg.src = event.target.result;
            if (previewContainer) previewContainer.style.display = 'block';
            if (dropZone) dropZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

function removeSitrepPhoto() {
    const fileInput = document.getElementById('sitrepPhotoInput');
    const dropZone = document.getElementById('sitrepPhotoDropZone');
    const previewContainer = document.getElementById('sitrepPhotoPreviewContainer');
    const previewImg = document.getElementById('sitrepPhotoPreviewImg');

    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    setupSitrepPhotoPreview();
});

async function submitFieldSitrep(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitSitrep');
    btn.innerHTML = 'Broadcasting Official SITREP...';
    btn.disabled = true;

    const form = document.getElementById('sitrepForm');
    const formData = new FormData(form);

    // Attach active officer deployment credentials
    if (typeof getOfficerProfile === 'function') {
        const prof = getOfficerProfile();
        formData.set('officer_name', prof.name);
        formData.set('officer_rank', prof.rank);
        formData.set('agency', prof.agency);
        formData.set('district', prof.district);
    }

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
        removeSitrepPhoto();

        // Re-sync officer profile after form reset
        if (typeof updateOfficerUI === 'function') {
            updateOfficerUI();
        }

        // Refresh hazards, alerts, fleet status and sitreps
        await loadHazardsAndZones();
        await loadFleetTracking();
        await loadLogisticsAlerts();
        await loadSitrepsList();

    } catch (err) {
        alert("SITREP Submission Error: " + err.message);
    } finally {
        btn.innerHTML = '📋 Broadcast Verified Situation Report';
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

        const isHq = (typeof isHeadquartersUser === 'function' ? isHeadquartersUser() : (localStorage.getItem('aapdamarg_user_role') === 'headquarters'));

        container.innerHTML = data.sitreps.map(s => {
            const dateStr = new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 8px; border-left: 4px solid #0284c7; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 800; background: #0284c7; color: white; padding: 2px 6px; border-radius: 3px;">
                            ${s.agency} VERIFIED
                        </span>
                        <span style="font-size: 10px; color: #64748b;">${dateStr}</span>
                    </div>
                    <strong style="font-size: 12px; color: #0f172a;">${s.corridor} (${s.district})</strong>
                    <div style="font-size: 11px; color: #334155; margin: 4px 0;">
                        <div>Officer: <strong>${s.officer_name} (${s.officer_rank})</strong></div>
                        <div>Clearance Progress: <strong>${s.clearance_pct}%</strong> • Status: <strong style="color: ${s.passability === 'closed' ? '#dc2626' : '#d97706'};">${s.passability.toUpperCase()}</strong></div>
                        <div>Bridge Condition: <strong>${s.bridge_status.toUpperCase()}</strong></div>
                    </div>
                    <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin-top: 4px;">"${s.notes}"</p>
                    ${s.photo_url ? `
                        <div style="margin-top: 8px; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; cursor: pointer;" onclick="if (typeof openPhotoModal === 'function') openPhotoModal('${s.photo_url}', '${s.corridor} - ${s.agency} SITREP')">
                            <img src="${s.photo_url}" alt="SITREP Evidence" style="width: 100%; height: 110px; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none'">
                            <div style="font-size: 10px; color: #0284c7; background: #f0f9ff; padding: 4px 6px; text-align: center; font-weight: 700;">🔍 Click to enlarge SITREP photo proof</div>
                        </div>
                    ` : ''}
                    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <button onclick="if (typeof zoomToCoord === 'function') zoomToCoord(${s.latitude}, ${s.longitude})" style="background: #eff6ff; color: #0284c7; border: 1px solid #bae6fd; border-radius: 4px; padding: 2px 7px; cursor: pointer; font-size: 10.5px; font-weight: 600;">
                            📍 View Location
                        </button>
                        ${isHq ? `
                            <button onclick="deleteFieldSitrep(${s.id}, '${escapeQuotes(s.corridor)}')" style="background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 10.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Authorized Headquarters Action: Remove SITREP">
                                🗑️ Remove SITREP (HQ)
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading SITREPs:", err);
    }
}

async function deleteFieldSitrep(id, corridor = '') {
    const isHq = (typeof isHeadquartersUser === 'function' ? isHeadquartersUser() : (localStorage.getItem('aapdamarg_user_role') === 'headquarters'));
    if (!isHq) {
        alert("Permission Denied: Only Headquarters personnel have authorization to remove field SITREPs.");
        return;
    }

    const confirmMsg = corridor 
        ? `Headquarters Authorization:\n\nAre you sure you want to remove field situation report for "${corridor}" (ID #${id})?\n\nThis will remove the official SITREP from the operational records.`
        : `Headquarters Authorization:\n\nAre you sure you want to remove field SITREP #${id}?`;

    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`/api/sitreps/${id}`, {
            method: 'DELETE',
            headers: {
                'X-User-Role': 'headquarters'
            }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: 'Failed to delete SITREP' }));
            throw new Error(errData.detail || 'Server error removing SITREP');
        }

        const data = await res.json();
        alert(`✅ ${data.message || 'SITREP successfully removed by Headquarters.'}`);

        // Dynamically refresh SITREP list
        await loadSitrepsList();
        if (typeof loadFleetTracking === 'function') await loadFleetTracking();
        if (typeof loadLogisticsAlerts === 'function') await loadLogisticsAlerts();
    } catch (err) {
        alert(`Failed to remove SITREP: ${err.message}`);
    }
}
