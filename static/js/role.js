// AapdaMarg NE - Multi-Persona Role & Authentication Controller

const USER_ROLES = {
    HEADQUARTERS: 'headquarters',
    FIELD_OFFICER: 'field_officer',
    GENERAL_PUBLIC: 'general_public'
};

const ROLE_CONFIGS = {
    headquarters: {
        id: 'headquarters',
        name: 'Headquarters Employee',
        title: 'SEOC Logistics Command',
        icon: '💼',
        badgeClass: 'role-badge-hq',
        defaultTab: 'tabFleet',
        description: 'State Disaster Logistics Controller tracking essential commodity convoys, corridor health & resource allocation.'
    },
    field_officer: {
        id: 'field_officer',
        name: 'Field Officer',
        title: 'NDRF / SDRF / Police Patrol',
        icon: '⭐',
        badgeClass: 'role-badge-officer',
        defaultTab: 'tabSitrep',
        description: 'Field official verifying structural damage, submitting road clearance SITREPs, and managing CAD emergency response.'
    },
    general_public: {
        id: 'general_public',
        name: 'General Public',
        title: 'Citizen / Guest Access',
        icon: '👤',
        badgeClass: 'role-badge-public',
        defaultTab: 'tabRoute',
        description: 'Citizen user accessing disaster-avoiding safe route navigation, 1-tap emergency SOS, relief camps & amenities.'
    }
};

let currentRole = localStorage.getItem('aapdamarg_user_role') || null;
let currentOfficerId = localStorage.getItem('aapdamarg_officer_id') || '';
let selectedLoginRole = USER_ROLES.HEADQUARTERS;

function isHeadquartersUser() {
    const r = currentRole || localStorage.getItem('aapdamarg_user_role');
    return r === USER_ROLES.HEADQUARTERS || r === 'headquarters';
}

// Field Officer Deployment Profile (Configured after officer login)
const DEFAULT_OFFICER_PROFILE = {
    name: 'Major R. Sangma',
    rank: 'Officer Commanding',
    agency: 'Border Roads Organisation (BRO)',
    district: 'East Jaintia Hills'
};

function getOfficerProfile() {
    return {
        name: localStorage.getItem('aapdamarg_officer_name') || DEFAULT_OFFICER_PROFILE.name,
        rank: localStorage.getItem('aapdamarg_officer_rank') || DEFAULT_OFFICER_PROFILE.rank,
        agency: localStorage.getItem('aapdamarg_officer_agency') || DEFAULT_OFFICER_PROFILE.agency,
        district: localStorage.getItem('aapdamarg_officer_district') || DEFAULT_OFFICER_PROFILE.district
    };
}

function saveOfficerProfile(prof) {
    if (prof.name) localStorage.setItem('aapdamarg_officer_name', prof.name.trim());
    if (prof.rank) localStorage.setItem('aapdamarg_officer_rank', prof.rank.trim());
    if (prof.agency) localStorage.setItem('aapdamarg_officer_agency', prof.agency.trim());
    if (prof.district) localStorage.setItem('aapdamarg_officer_district', prof.district.trim());
    updateOfficerUI();
}

function updateOfficerUI() {
    const prof = getOfficerProfile();
    
    // 1. Update SITREP Verified Identity Strip & Hidden Inputs
    const badgeOfficer = document.getElementById('sitrepBadgeOfficer');
    const badgeAgency = document.getElementById('sitrepBadgeAgency');
    const inputName = document.getElementById('sitrepOfficerName');
    const inputRank = document.getElementById('sitrepOfficerRank');
    const inputAgency = document.getElementById('sitrepAgency');
    const inputDistrict = document.getElementById('sitrepDistrict');

    if (badgeOfficer) badgeOfficer.innerText = `${prof.name} (${prof.rank})`;
    if (badgeAgency) badgeAgency.innerText = `${prof.agency} • ${prof.district}`;
    if (inputName) inputName.value = prof.name;
    if (inputRank) inputRank.value = prof.rank;
    if (inputAgency) inputAgency.value = prof.agency;
    if (inputDistrict) inputDistrict.value = prof.district;

    // 2. Update Settings Dropdown item
    const menuSub = document.getElementById('menuOfficerProfileSub');
    if (menuSub) menuSub.innerText = `${prof.name} • ${prof.agency} (${prof.district})`;

    // 3. Update Tactical Console Banner Subtitle
    const bannerSubtitle = document.getElementById('officerBannerSubtitle');
    if (bannerSubtitle) {
        bannerSubtitle.innerText = `${prof.name} (${prof.rank}) • ${prof.agency} • Sector: ${prof.district}`;
    }
}

let isOfficerProfileFromLogin = false;

function openOfficerProfileModal(fromLogin = false) {
    isOfficerProfileFromLogin = fromLogin;
    const modal = document.getElementById('officerProfileModal');
    if (!modal) return;
    
    const prof = getOfficerProfile();
    const inputName = document.getElementById('officerProfName');
    const inputRank = document.getElementById('officerProfRank');
    const inputAgency = document.getElementById('officerProfAgency');
    const inputDistrict = document.getElementById('officerProfDistrict');

    if (inputName) inputName.value = prof.name;
    if (inputRank) inputRank.value = prof.rank;
    if (inputAgency) {
        inputAgency.value = prof.agency;
        if (!inputAgency.value) {
            for (let i = 0; i < inputAgency.options.length; i++) {
                const opt = inputAgency.options[i];
                if (opt.value.includes(prof.agency) || prof.agency.includes(opt.value)) {
                    inputAgency.selectedIndex = i;
                    break;
                }
            }
        }
    }
    if (inputDistrict) inputDistrict.value = prof.district;

    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    modal.style.visibility = 'visible';
}

function closeOfficerProfileModal(e) {
    if (e && e.target && e.target.closest && e.target.closest('.login-modal-card') && !e.target.classList.contains('modal-close')) {
        return;
    }
    const modal = document.getElementById('officerProfileModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }
    if (isOfficerProfileFromLogin) {
        isOfficerProfileFromLogin = false;
        selectRole(USER_ROLES.FIELD_OFFICER, currentOfficerId || 'NDRF-102');
    }
}

function handleSaveOfficerProfile(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('officerProfName')?.value?.trim() || DEFAULT_OFFICER_PROFILE.name;
    const rank = document.getElementById('officerProfRank')?.value?.trim() || DEFAULT_OFFICER_PROFILE.rank;
    const agency = document.getElementById('officerProfAgency')?.value || DEFAULT_OFFICER_PROFILE.agency;
    const district = document.getElementById('officerProfDistrict')?.value?.trim() || DEFAULT_OFFICER_PROFILE.district;

    saveOfficerProfile({ name, rank, agency, district });

    const modal = document.getElementById('officerProfileModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }

    if (isOfficerProfileFromLogin) {
        isOfficerProfileFromLogin = false;
        selectRole(USER_ROLES.FIELD_OFFICER, currentOfficerId || 'NDRF-102');
    } else {
        updateOfficerUI();
    }
    return false;
}

// Initialize role subsystem
function initRoleSubsystem() {
    if (!currentRole) {
        currentRole = USER_ROLES.GENERAL_PUBLIC;
        localStorage.setItem('aapdamarg_user_role', currentRole);
    }
    applyRoleInterface(currentRole);
    
    // Close dropdown menu when clicking anywhere outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('roleDropdownMenu');
        const btn = document.getElementById('btnUserRoleBadge');
        if (menu && menu.classList.contains('active')) {
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.remove('active');
            }
        }
    });

    // Automatically pop up login modal whenever someone opens the link
    setTimeout(() => {
        openLoginModal();
    }, 250);
}

// Open Login Modal
function openLoginModal(targetRole = null) {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.style.visibility = 'visible';
    }
    hideLoginNotice();
    setLoginRole(targetRole || USER_ROLES.HEADQUARTERS);
    
    // Always start with completely blank inputs
    const idInput = document.getElementById('loginIdentifier');
    const pwdInput = document.getElementById('loginPassword');
    if (idInput) idInput.value = '';
    if (pwdInput) pwdInput.value = '';
}

// Set active tab in login modal
function setLoginRole(roleId) {
    if (!ROLE_CONFIGS[roleId]) roleId = USER_ROLES.HEADQUARTERS;
    selectedLoginRole = roleId;
    hideLoginNotice();

    const tabHq = document.getElementById('authTabHq');
    const tabOfficer = document.getElementById('authTabOfficer');
    const tabPublic = document.getElementById('authTabPublic');

    if (tabHq) tabHq.classList.toggle('active', roleId === USER_ROLES.HEADQUARTERS);
    if (tabOfficer) tabOfficer.classList.toggle('active', roleId === USER_ROLES.FIELD_OFFICER);
    if (tabPublic) tabPublic.classList.toggle('active', roleId === USER_ROLES.GENERAL_PUBLIC);

    const roleBadge = document.getElementById('authRoleLabel');
    const idInput = document.getElementById('loginIdentifier');
    const pwdInput = document.getElementById('loginPassword');
    const submitBtnText = document.getElementById('btnLoginSubmitText');
    const demoHint = document.getElementById('authDemoHint');

    if (roleId === USER_ROLES.HEADQUARTERS) {
        if (roleBadge) {
            roleBadge.innerText = 'Headquarters Employee';
            roleBadge.style.background = '#eff6ff';
            roleBadge.style.color = '#1d4ed8';
            roleBadge.style.borderColor = '#bfdbfe';
        }
        if (idInput) {
            idInput.placeholder = 'Enter Authorized Phone / ID';
            idInput.required = true;
            idInput.value = '';
        }
        if (pwdInput) {
            pwdInput.required = true;
            pwdInput.placeholder = 'Enter password';
            pwdInput.value = '';
        }
        if (submitBtnText) submitBtnText.innerText = 'Sign In to Headquarters';
        if (demoHint) demoHint.innerHTML = 'Authorized personnel only';
    } else if (roleId === USER_ROLES.FIELD_OFFICER) {
        if (roleBadge) {
            roleBadge.innerText = 'Field Officer Patrol';
            roleBadge.style.background = '#f0fdfa';
            roleBadge.style.color = '#0f766e';
            roleBadge.style.borderColor = '#99f6e4';
        }
        if (idInput) {
            idInput.placeholder = 'Enter Authorized Phone / ID';
            idInput.required = true;
            idInput.value = '';
        }
        if (pwdInput) {
            pwdInput.required = true;
            pwdInput.placeholder = 'Enter password';
            pwdInput.value = '';
        }
        if (submitBtnText) submitBtnText.innerText = 'Sign In as Field Officer';
        if (demoHint) demoHint.innerHTML = 'Authorized personnel only';
    } else { // general_public
        if (roleBadge) {
            roleBadge.innerText = 'Citizen Access';
            roleBadge.style.background = '#ecfdf5';
            roleBadge.style.color = '#047857';
            roleBadge.style.borderColor = '#a7f3d0';
        }
        if (idInput) {
            idInput.placeholder = 'Mobile number or Citizen ID (Optional)';
            idInput.required = false;
            idInput.value = '';
        }
        if (pwdInput) {
            pwdInput.required = false;
            pwdInput.placeholder = 'Password (Optional for Public)';
            pwdInput.value = '';
        }
        if (submitBtnText) submitBtnText.innerText = 'Continue as Public';
        if (demoHint) demoHint.innerHTML = 'Public access (Password optional)';
    }
}

// Open login modal targeted directly at a specific role
function openLoginForRole(roleId = 'headquarters') {
    const menu = document.getElementById('roleDropdownMenu');
    if (menu) menu.classList.remove('active');

    openLoginModal();
    setLoginRole(roleId);

    // Keep inputs completely blank
    const idInput = document.getElementById('loginIdentifier');
    const pwdInput = document.getElementById('loginPassword');
    if (idInput) idInput.value = '';
    if (pwdInput) pwdInput.value = '';
}

// Quick autofill of authorized credentials disabled for security
function fillDemoCredentials() {
    // Disabled: never disclose or auto-populate privileged credentials
}

// Toggle password input text vs password
function togglePasswordVisibility() {
    const pwdInput = document.getElementById('loginPassword');
    const btn = document.querySelector('.btn-toggle-pwd');
    if (!pwdInput) return;
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        if (btn) btn.innerText = '🙈';
    } else {
        pwdInput.type = 'password';
        if (btn) btn.innerText = '👁️';
    }
}

// Notification helpers for authentication
function showLoginNotification(message) {
    const notice = document.getElementById('loginAuthNotice');
    const noticeText = document.getElementById('loginAuthNoticeText');
    if (notice && noticeText) {
        noticeText.innerText = message;
        notice.style.display = 'flex';
    }
    const pwdInput = document.getElementById('loginPassword');
    const idInput = document.getElementById('loginIdentifier');
    if (pwdInput) {
        pwdInput.style.borderColor = '#ef4444';
        pwdInput.value = '';
        pwdInput.focus();
    }
    if (idInput) {
        idInput.style.borderColor = '#ef4444';
    }
    alert(message);
}

function hideLoginNotice() {
    const notice = document.getElementById('loginAuthNotice');
    if (notice) notice.style.display = 'none';
    const pwdInput = document.getElementById('loginPassword');
    const idInput = document.getElementById('loginIdentifier');
    if (pwdInput) pwdInput.style.borderColor = '';
    if (idInput) idInput.style.borderColor = '';
}

// Form submit handler with strict credential verification
function handleAuthLogin(event) {
    if (event) event.preventDefault();
    const idInput = document.getElementById('loginIdentifier');
    const pwdInput = document.getElementById('loginPassword');
    
    let enteredId = idInput ? idInput.value.trim() : '';
    let enteredPwd = pwdInput ? pwdInput.value.trim() : '';

    if (selectedLoginRole === USER_ROLES.GENERAL_PUBLIC) {
        hideLoginNotice();
        selectRole(USER_ROLES.GENERAL_PUBLIC);
        return false;
    }

    if (!enteredId) {
        showLoginNotification('Please enter your authorized Phone Number / ID.');
        if (idInput) idInput.focus();
        return false;
    }
    if (!enteredPwd) {
        showLoginNotification('Please enter your Password.');
        if (pwdInput) pwdInput.focus();
        return false;
    }

    // Strict authentication rules:
    // Headquarters Employee: Phone 9826091678 & Password aadijain
    // Field Officer: Phone 9926530440 & Password krishna
    if (selectedLoginRole === USER_ROLES.HEADQUARTERS) {
        if (enteredId === '9826091678' && enteredPwd === 'aadijain') {
            hideLoginNotice();
            currentOfficerId = 'HQ-9826091678';
            localStorage.setItem('aapdamarg_officer_id', currentOfficerId);
            selectRole(USER_ROLES.HEADQUARTERS, currentOfficerId);
            return false;
        } else {
            showLoginNotification('Invalid credentials! Please check your ID and password.');
            return false;
        }
    } else if (selectedLoginRole === USER_ROLES.FIELD_OFFICER) {
        if (enteredId === '9926530440' && enteredPwd === 'krishna') {
            hideLoginNotice();
            currentOfficerId = 'OFFICER-9926530440';
            localStorage.setItem('aapdamarg_officer_id', currentOfficerId);

            // Hide login modal
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
                modal.style.opacity = '0';
                modal.style.pointerEvents = 'none';
            }

            // Trigger Officer Deployment Profile Modal immediately after officer login
            openOfficerProfileModal(true);
            return false;
        } else {
            showLoginNotification('Invalid credentials! Please check your ID and password.');
            return false;
        }
    } else {
        hideLoginNotice();
        selectRole(USER_ROLES.GENERAL_PUBLIC);
        return false;
    }
}

// Close Login Modal
function closeLoginModal(e) {
    if (e && e.target && e.target.closest && e.target.closest('.login-modal-card') && !e.target.classList.contains('modal-close')) {
        return;
    }
    // Only allow closing if a role is already set
    if (!currentRole) {
        currentRole = USER_ROLES.GENERAL_PUBLIC;
        localStorage.setItem('aapdamarg_user_role', currentRole);
        applyRoleInterface(currentRole);
    }
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }
}

// Select Role
function selectRole(roleId, customId = '') {
    if (!ROLE_CONFIGS[roleId]) roleId = USER_ROLES.GENERAL_PUBLIC;
    
    currentRole = roleId;
    localStorage.setItem('aapdamarg_user_role', roleId);
    
    if (customId) {
        currentOfficerId = customId;
        localStorage.setItem('aapdamarg_officer_id', customId);
    } else if (roleId === USER_ROLES.HEADQUARTERS) {
        currentOfficerId = 'NE-SEOC-LOG-01';
        localStorage.setItem('aapdamarg_officer_id', currentOfficerId);
    } else if (roleId === USER_ROLES.FIELD_OFFICER) {
        currentOfficerId = 'NDRF-1BN-PATROL';
        localStorage.setItem('aapdamarg_officer_id', currentOfficerId);
    }

    // Close login modal if open
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }

    // Close dropdown menu if open
    const menu = document.getElementById('roleDropdownMenu');
    if (menu) menu.classList.remove('active');

    // Close mobile menu if open
    closeMobileMenuModal();

    // Apply interface
    applyRoleInterface(roleId);
}

// Toggle role dropdown menu
function toggleRoleMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('roleDropdownMenu');
    if (menu) {
        menu.classList.toggle('active');
    }
}

// Apply Role Interface Transformations
function applyRoleInterface(roleId) {
    if (!ROLE_CONFIGS[roleId]) roleId = USER_ROLES.GENERAL_PUBLIC;
    currentRole = roleId;
    localStorage.setItem('aapdamarg_user_role', roleId);
    const config = ROLE_CONFIGS[roleId];
    
    // 1. Update Header Settings Button (Clean "Settings", no role suffix)
    const badgeBtn = document.getElementById('btnUserRoleBadge');
    if (badgeBtn) {
        badgeBtn.className = 'btn btn-secondary btn-settings-trigger';
        badgeBtn.title = 'Settings';
    }

    const menuCurrentRole = document.getElementById('menuCurrentRoleName');
    if (menuCurrentRole) {
        if (roleId === USER_ROLES.HEADQUARTERS) {
            menuCurrentRole.innerText = '💼 Logged In: Headquarters';
        } else if (roleId === USER_ROLES.FIELD_OFFICER) {
            menuCurrentRole.innerText = '⭐ Logged In: Field Officer';
        } else {
            menuCurrentRole.innerText = '👤 Guest Mode (Citizen Access)';
        }
    }

    // Update Settings dropdown Officer Profile button visibility
    const officerMenuBtn = document.getElementById('menuOfficerProfileBtn');
    const officerMenuDiv = document.getElementById('menuOfficerProfileDivider');
    if (officerMenuBtn) officerMenuBtn.style.display = (roleId === USER_ROLES.FIELD_OFFICER) ? 'flex' : 'none';
    if (officerMenuDiv) officerMenuDiv.style.display = (roleId === USER_ROLES.FIELD_OFFICER) ? 'block' : 'none';

    // Update Settings dropdown Guest and Signout items
    const guestBtn = document.getElementById('menuGuestBtn');
    const guestDiv = document.getElementById('menuGuestModeDivider');
    const signoutBtn = document.getElementById('menuSignoutBtn');
    const signoutDiv = document.getElementById('menuSignoutDivider');
    const isSpecialRole = (roleId === USER_ROLES.HEADQUARTERS || roleId === USER_ROLES.FIELD_OFFICER);
    if (guestBtn) guestBtn.style.display = isSpecialRole ? 'flex' : 'none';
    if (guestDiv) guestDiv.style.display = isSpecialRole ? 'block' : 'none';
    if (signoutBtn) signoutBtn.style.display = isSpecialRole ? 'flex' : 'none';
    if (signoutDiv) signoutDiv.style.display = isSpecialRole ? 'block' : 'none';

    // Update Mobile Menu indicator
    const mobileRoleBadge = document.getElementById('mobileRoleBadge');
    if (mobileRoleBadge) {
        mobileRoleBadge.innerHTML = `
            <div>
                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Active Persona</div>
                <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${config.icon} ${config.name}</div>
                <div style="font-size: 10px; color: #38bdf8;">${config.title}</div>
            </div>
        `;
    }

    // 2. Persona Banners over the GIS Map
    const hqBanner = document.getElementById('hqFleetRadarBanner');
    const officerBanner = document.getElementById('officerTacticalBanner');
    const btnRestoreHq = document.getElementById('btnRestoreHqBanner');
    const btnRestoreOfficer = document.getElementById('btnRestoreOfficerBanner');
    
    if (hqBanner) {
        hqBanner.style.display = (roleId === USER_ROLES.HEADQUARTERS) ? 'flex' : 'none';
    }
    if (officerBanner) {
        officerBanner.style.display = (roleId === USER_ROLES.FIELD_OFFICER) ? 'flex' : 'none';
    }
    if (btnRestoreHq) btnRestoreHq.style.display = 'none';
    if (btnRestoreOfficer) btnRestoreOfficer.style.display = 'none';

    const hud = document.getElementById('gpsHudBar');
    if (hud && window.innerWidth > 768) {
        const hasBanner = (roleId === USER_ROLES.HEADQUARTERS || roleId === USER_ROLES.FIELD_OFFICER);
        hud.style.top = hasBanner ? '72px' : '15px';
    }

    // 3. Desktop & Mobile Header Actions Customization
    // User requirement: restore all buttons in the header!
    const btnSos = document.getElementById('btnHeaderSos') || document.querySelector('.btn-sos');
    const btnDashboard = document.getElementById('btnHeaderDashboard') || document.querySelector('.btn-desktop-only[onclick*="openCommandDashboard"]');
    const btnSitrep = document.getElementById('btnHeaderSitrep') || document.querySelector('.btn-desktop-only[onclick*="openSitrepModal"]');
    const btnGps = document.getElementById('btnToggleGps');
    const btnSim = document.getElementById('btnDriveSim');
    const btnReport = document.getElementById('btnHeaderReport') || document.querySelector('.btn-desktop-only[onclick*="openReportModal"]');
    const btnCamps = document.getElementById('btnHeaderCamps') || document.querySelector('.btn-desktop-only[onclick*="openEmergencyModal"]');
    const mapDropdown = document.getElementById('mapDropdownContainer');
    const btnTools = document.getElementById('btnHeaderTools');

    // Show base buttons
    [btnSos, btnDashboard, btnSitrep, btnGps, btnSim, btnReport, btnCamps, mapDropdown, btnTools].forEach(btn => {
        if (btn) btn.style.display = '';
    });

    // Role-specific Header & Mobile Actions:
    // 1. Guest/Citizen page: remove Central Dashboard & Officer SITREP. GPS, Simulate Drive, and Report Hazard remain.
    // 2. Headquarters page: keep ALL buttons (Central Dashboard, Officer SITREP, GPS, Simulate Drive, Report Hazard, etc.).
    // 3. Employee (Field Officer) page: remove Central Dashboard, GPS, Simulate Drive, and Report Hazard. Officer SITREP remains.
    const mTileDashboard = document.querySelector('.m-menu-tile[onclick*="openCommandDashboard"]');
    const mTileSitrep = document.querySelector('.m-menu-tile[onclick*="openSitrepModal"]');
    const mTileReport = document.getElementById('mTileReport') || document.querySelector('.m-menu-tile[onclick*="openReportModal"]');
    const btnOfficerBannerReport = document.getElementById('btnOfficerBannerReport');
    const mNavSos = document.querySelector('.m-nav-sos');
    const mTileGps = document.getElementById('mTileLiveGps');
    const mTileSim = document.querySelector('.m-menu-tile[onclick*="toggleDriveSimulator"]');

    if (mNavSos) mNavSos.style.display = 'flex';

    if (roleId === USER_ROLES.GENERAL_PUBLIC) {
        // Guest/Citizen: Remove Central Dashboard and Officer SITREP
        if (btnDashboard) btnDashboard.style.display = 'none';
        if (btnSitrep) btnSitrep.style.display = 'none';
        if (mTileDashboard) mTileDashboard.style.display = 'none';
        if (mTileSitrep) mTileSitrep.style.display = 'none';

        // GPS, Simulate Drive, and Report Hazard remain visible
        if (btnGps) btnGps.style.display = '';
        if (btnSim) btnSim.style.display = '';
        if (btnReport) btnReport.style.display = '';
        if (mTileGps) mTileGps.style.display = 'flex';
        if (mTileSim) mTileSim.style.display = 'flex';
        if (mTileReport) mTileReport.style.display = 'flex';
    } else if (roleId === USER_ROLES.FIELD_OFFICER) {
        // Employee (Field Officer): Remove Central Dashboard, GPS, Simulate Drive, and Report Hazard
        if (btnDashboard) btnDashboard.style.display = 'none';
        if (mTileDashboard) mTileDashboard.style.display = 'none';

        if (btnGps) btnGps.style.display = 'none';
        if (mTileGps) mTileGps.style.display = 'none';

        if (btnSim) btnSim.style.display = 'none';
        if (mTileSim) mTileSim.style.display = 'none';

        if (btnReport) btnReport.style.display = 'none';
        if (mTileReport) mTileReport.style.display = 'none';
        if (btnOfficerBannerReport) btnOfficerBannerReport.style.display = 'none';

        // Officer SITREP remains visible for Employee
        if (btnSitrep) btnSitrep.style.display = '';
        if (mTileSitrep) mTileSitrep.style.display = 'flex';
    } else {
        // Headquarters: Central Dashboard remains VISIBLE
        if (btnDashboard) btnDashboard.style.display = '';
        if (mTileDashboard) mTileDashboard.style.display = 'flex';

        // Explicitly REMOVE for Headquarters Employee:
        // 1. SOS Dispatch button
        if (btnSos) btnSos.style.display = 'none';
        if (mNavSos) mNavSos.style.display = 'none';

        // 2. Officer SITREP
        if (btnSitrep) btnSitrep.style.display = 'none';
        if (mTileSitrep) mTileSitrep.style.display = 'none';

        // 3. Report Hazard
        if (btnReport) btnReport.style.display = 'none';
        if (mTileReport) mTileReport.style.display = 'none';

        // 4. Simulate Drive
        if (btnSim) btnSim.style.display = 'none';
        if (mTileSim) mTileSim.style.display = 'none';

        // 5. Live GPS
        if (btnGps) btnGps.style.display = 'none';
        if (mTileGps) mTileGps.style.display = 'none';

        // Ensure GPS HUD & background simulator/tracking are inactive
        const hud = document.getElementById('gpsHudBar');
        if (hud) {
            hud.classList.add('hidden');
            hud.style.setProperty('display', 'none', 'important');
        }
        if (typeof stopDriveSimulator === 'function' && typeof isSimulating !== 'undefined' && isSimulating) {
            stopDriveSimulator();
        }
        if (typeof toggleGpsTracking === 'function' && typeof isGpsActive !== 'undefined' && isGpsActive) {
            toggleGpsTracking();
        }
    }

    // 4. Sidebar Tabs Customization
    const tabFleetNav = document.querySelector('.sidebar-tab[data-tab="tabFleet"]');
    const tabSitrepNav = document.querySelector('.sidebar-tab[data-tab="tabSitrep"]');
    const tabFeedNav = document.querySelector('.sidebar-tab[data-tab="tabFeed"]');

    if (roleId === USER_ROLES.GENERAL_PUBLIC) {
        if (tabFleetNav) tabFleetNav.style.display = 'none';
        if (tabSitrepNav) tabSitrepNav.style.display = 'none';
        if (tabFeedNav) tabFeedNav.style.display = 'block';
    } else if (roleId === USER_ROLES.FIELD_OFFICER) {
        if (tabFleetNav) tabFleetNav.style.display = 'none';
        if (tabSitrepNav) tabSitrepNav.style.display = 'block';
        if (tabFeedNav) tabFeedNav.style.display = 'block';
    } else { // HEADQUARTERS
        if (tabFleetNav) tabFleetNav.style.display = 'block';
        if (tabSitrepNav) tabSitrepNav.style.display = 'block';
        if (tabFeedNav) tabFeedNav.style.display = 'block';
    }

    // 5. Switch to Default Tab for the Role
    const defaultTab = config.defaultTab;
    const allTabs = document.querySelectorAll('.sidebar-tab');
    allTabs.forEach(t => t.classList.remove('active'));
    const targetTabBtn = document.querySelector(`.sidebar-tab[data-tab="${defaultTab}"]`);
    if (targetTabBtn) {
        targetTabBtn.classList.add('active');
    }
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const activeContent = document.getElementById(defaultTab);
    if (activeContent) {
        activeContent.style.display = 'flex';
    }
    if (window.innerWidth <= 768 && typeof switchMobileView === 'function') {
        switchMobileView(defaultTab);
    }

    // 6. Mobile Bottom Nav 4th Item Adaptation
    const mNavFleet = document.getElementById('mNavFleet');
    if (mNavFleet) {
        if (roleId === USER_ROLES.HEADQUARTERS) {
            mNavFleet.innerHTML = `<span class="m-nav-icon">🚚</span><span class="m-nav-text">Fleet</span>`;
            mNavFleet.onclick = () => switchMobileView('tabFleet');
        } else if (roleId === USER_ROLES.FIELD_OFFICER) {
            mNavFleet.innerHTML = `<span class="m-nav-icon">📋</span><span class="m-nav-text">SITREP</span>`;
            mNavFleet.onclick = () => switchMobileView('tabSitrep');
        } else {
            mNavFleet.innerHTML = `<span class="m-nav-icon">🏥</span><span class="m-nav-text">Camps</span>`;
            mNavFleet.onclick = () => openEmergencyModal();
        }
    }

    // 7. Ensure Relevant GIS Map Layers are Visible
    if (window.layerGroups) {
        if (roleId === USER_ROLES.HEADQUARTERS && window.layerGroups.fleet) {
            if (window.map && !window.map.hasLayer(window.layerGroups.fleet)) {
                window.layerGroups.fleet.addTo(window.map);
            }
        }
    }

    // 8. Auto-sync Officer Profile in SITREP & Banners if field officer
    if (roleId === USER_ROLES.FIELD_OFFICER) {
        updateOfficerUI();
    }

    // 9. Dynamically refresh feeds and map popups to reflect HQ administrative actions
    if (typeof loadCommunityFeed === 'function') loadCommunityFeed();
    if (typeof loadSitrepsList === 'function') loadSitrepsList();
    if (typeof loadHazardsAndZones === 'function') loadHazardsAndZones();
}

// Quick 1-Click Reroute All Convoys from HQ Banner
async function hqAutoRerouteAll() {
    const btn = document.getElementById('btnHqAutoReroute');
    if (btn) btn.innerText = 'Rerouting Fleet...';
    
    try {
        await rerouteFleetTruck('FL-02');
        if (btn) btn.innerText = '✅ Convoys Rerouted Safe';
        setTimeout(() => {
            if (btn) btn.innerText = '⚡ Auto-Reroute Fleet';
        }, 3000);
    } catch (e) {
        if (btn) btn.innerText = '⚡ Auto-Reroute Fleet';
    }
}

// Hide & Restore Floating Persona Banners
function dismissHqBanner() {
    const hqBanner = document.getElementById('hqFleetRadarBanner');
    const btnRestore = document.getElementById('btnRestoreHqBanner');
    if (hqBanner) hqBanner.style.display = 'none';
    if (btnRestore) btnRestore.style.display = 'inline-flex';
    const hud = document.getElementById('gpsHudBar');
    if (hud && window.innerWidth > 768) {
        hud.style.top = '15px';
    }
}

function restoreHqBanner() {
    const hqBanner = document.getElementById('hqFleetRadarBanner');
    const btnRestore = document.getElementById('btnRestoreHqBanner');
    if (hqBanner) hqBanner.style.display = 'flex';
    if (btnRestore) btnRestore.style.display = 'none';
    const hud = document.getElementById('gpsHudBar');
    if (hud && window.innerWidth > 768) {
        hud.style.top = '72px';
    }
}

function dismissOfficerBanner() {
    const officerBanner = document.getElementById('officerTacticalBanner');
    const btnRestore = document.getElementById('btnRestoreOfficerBanner');
    if (officerBanner) officerBanner.style.display = 'none';
    if (btnRestore) btnRestore.style.display = 'inline-flex';
    const hud = document.getElementById('gpsHudBar');
    if (hud && window.innerWidth > 768) {
        hud.style.top = '15px';
    }
}

function restoreOfficerBanner() {
    const officerBanner = document.getElementById('officerTacticalBanner');
    const btnRestore = document.getElementById('btnRestoreOfficerBanner');
    if (officerBanner) officerBanner.style.display = 'flex';
    if (btnRestore) btnRestore.style.display = 'none';
    const hud = document.getElementById('gpsHudBar');
    if (hud && window.innerWidth > 768) {
        hud.style.top = '72px';
    }
}

// Sign Out & Session Reset to Guest Mode
function handleSignOut() {
    localStorage.removeItem('aapdamarg_user_role');
    localStorage.removeItem('aapdamarg_officer_id');
    localStorage.removeItem('aapdamarg_officer_name');
    localStorage.removeItem('aapdamarg_officer_rank');
    localStorage.removeItem('aapdamarg_officer_agency');
    localStorage.removeItem('aapdamarg_officer_district');
    currentRole = USER_ROLES.GENERAL_PUBLIC;
    currentOfficerId = '';
    localStorage.setItem('aapdamarg_user_role', currentRole);

    // Close settings dropdown and mobile menus
    const menu = document.getElementById('roleDropdownMenu');
    if (menu) menu.classList.remove('active');
    closeMobileMenuModal();

    // Reset interface to clean General Public baseline
    applyRoleInterface(USER_ROLES.GENERAL_PUBLIC);
}
