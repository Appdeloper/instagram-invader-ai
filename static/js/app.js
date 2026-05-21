// Global Application State
let files = {
    portrait: null,
    profile: null
};

let resultBlobUrl = null;
let activeTab = 'dashboard';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initTabNavigation();
    initUploadDropzones();
    initPresets();
    initThemeSwitch();
    initGlowSlider();
    initInvadeActions();
    initComparisonSlider();
    loadHistory();
});

// 1. Tab Navigation
function initTabNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            switchTab(targetTab);
        });
    });

    // Logo click goes back to Dashboard
    document.getElementById('logo-trigger').addEventListener('click', () => {
        switchTab('dashboard');
    });
}

function switchTab(tabId) {
    if (activeTab === tabId) return;
    
    // Deactivate current tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === `${tabId}-tab`) pane.classList.remove('hidden');
        else pane.classList.add('hidden');
    });

    activeTab = tabId;
    window.activeTab = tabId;

    // Refresh history grid if entering history tab
    if (tabId === 'history') {
        renderHistory();
    }
}

// 2. Drag & Drop Upload Handlers
function initUploadDropzones() {
    const zones = [
        { type: 'portrait', zoneId: 'portrait-dropzone', inputId: 'portrait-input' },
        { type: 'profile', zoneId: 'profile-dropzone', inputId: 'profile-input' }
    ];

    zones.forEach(({ type, zoneId, inputId }) => {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);

        zone.addEventListener('click', (e) => {
            // Prevent trigger if click was on remove button or sample picker
            if (e.target.closest('.remove-upload-btn') || e.target.closest('.sample-picker-bar')) return;
            input.click();
        });

        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                handleUploadedFile(input.files[0], type);
            }
        });

        // Drag events
        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                zone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                zone.classList.remove('dragover');
            }, false);
        });

        zone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            if (file && file.type.startsWith('image/')) {
                input.files = dt.files;
                handleUploadedFile(file, type);
            }
        }, false);
    });
}

function handleUploadedFile(file, type) {
    files[type] = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const previewContainer = document.getElementById(`${type}-preview-container`);
        const previewImg = document.getElementById(`${type}-preview-img`);
        
        previewImg.src = e.target.result;
        previewContainer.classList.remove('hidden');

        // Feed original preview into comparison slider
        if (type === 'profile') {
            document.getElementById('result-before-viewport').src = e.target.result;
        }

        checkEnableSubmit();
    };
    reader.readAsDataURL(file);
}

function clearUpload(type, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    files[type] = null;
    document.getElementById(`${type}-input`).value = '';
    document.getElementById(`${type}-preview-img`).src = '';
    document.getElementById(`${type}-preview-container`).classList.add('hidden');

    if (type === 'profile') {
        document.getElementById('result-before-viewport').src = '';
    }

    checkEnableSubmit();
}

// Loads a sample portrait from the assets
async function loadSamplePortrait(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], "sample_portrait.png", { type: "image/png" });
        handleUploadedFile(file, 'portrait');
    } catch (e) {
        console.error("Failed to load sample portrait: ", e);
    }
}

function checkEnableSubmit() {
    const invadeBtn = document.getElementById('invade-now-btn');
    const headerBtn = document.getElementById('nav-invade-btn');
    
    // Only portrait is strictly required now! Profile is optional.
    if (files.portrait) {
        invadeBtn.removeAttribute('disabled');
        headerBtn.removeAttribute('disabled');
    } else {
        invadeBtn.setAttribute('disabled', 'true');
        headerBtn.setAttribute('disabled', 'true');
    }
}

// 3. Tear Presets selector
function initPresets() {
    const presetCards = document.querySelectorAll('.preset-card');
    const styleInput = document.getElementById('tear_style');

    presetCards.forEach(card => {
        card.addEventListener('click', () => {
            presetCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            styleInput.value = card.dataset.preset;
        });
    });

    // Presets showcase page cards click handler
    const showcaseCards = document.querySelectorAll('.preset-gallery-card');
    showcaseCards.forEach(card => {
        card.addEventListener('click', () => {
            const presetType = card.dataset.preset;
            
            // Set active state on dashboard selector
            presetCards.forEach(c => {
                if (c.dataset.preset === presetType) c.classList.add('active');
                else c.classList.remove('active');
            });
            styleInput.value = presetType;
            
            // Direct to dashboard
            switchTab('dashboard');
        });
    });
}

// 4. Dark/Light Theme Switches
function initThemeSwitch() {
    const btns = document.querySelectorAll('.theme-switch-btn');
    const themeInput = document.getElementById('theme');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            themeInput.value = btn.dataset.theme;
        });
    });
}

// 5. Glow intensity Slider
function initGlowSlider() {
    const slider = document.getElementById('intensity-slider');
    const valueLabel = document.getElementById('glow-value');

    slider.addEventListener('input', (e) => {
        valueLabel.textContent = `${Math.round(e.target.value * 65)}%`; // Scaled to read nicely around 65%-100%
    });
}

// 6. Invade Trigger action pipeline
function initInvadeActions() {
    const form = document.getElementById('generator-form');
    const invadeBtn = document.getElementById('invade-now-btn');
    const headerInvadeBtn = document.getElementById('nav-invade-btn');

    const awaitingState = document.getElementById('awaiting-state');
    const processingState = document.getElementById('processing-state');
    const successState = document.getElementById('success-state');
    const statusText = document.querySelector('.processing-status-text');

    const triggerInvasion = async () => {
        if (!files.portrait) return;

        // Ensure user is authenticated
        if (!window.currentUser) {
            const authOverlay = document.getElementById('auth-overlay');
            if (authOverlay) {
                authOverlay.style.display = 'flex';
            }
            alert('Please sign in or register to execute the invasion engine.');
            return;
        }

        // Switch to processing view
        awaitingState.classList.add('hidden');
        successState.classList.add('hidden');
        processingState.classList.remove('hidden');
        invadeBtn.setAttribute('disabled', 'true');
        headerInvadeBtn.setAttribute('disabled', 'true');

        resetMilestones();
        updateMilestone(0, 'active');
        statusText.textContent = "Booting processing pipelines...";

        const formData = new FormData(form);
        formData.append('portrait', files.portrait);
        if (files.profile) {
            formData.append('profile', files.profile);
        }

        // Timer intervals for mock loading states
        const progressTimers = [
            setTimeout(() => {
                updateMilestone(0, 'completed');
                updateMilestone(1, 'active');
                statusText.textContent = "Isolating subject background (rembg)...";
            }, 1200),
            setTimeout(() => {
                updateMilestone(1, 'completed');
                updateMilestone(2, 'active');
                statusText.textContent = "Procedurally drawing Instagram vectors...";
            }, 3500),
            setTimeout(() => {
                updateMilestone(2, 'completed');
                updateMilestone(3, 'active');
                statusText.textContent = "Adjusting spotlights and depth of field...";
            }, 6000)
        ];

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                body: formData
            });

            // Stop animations
            progressTimers.forEach(clearTimeout);

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Pipeline execution failed on server.');
            }

            const blob = await response.blob();
            
            if (resultBlobUrl) {
                URL.revokeObjectURL(resultBlobUrl);
            }
            resultBlobUrl = URL.createObjectURL(blob);

            // Populate success views
            document.getElementById('result-after-viewport').src = resultBlobUrl;
            
            // If profile was not uploaded, set default preview base in comparison
            if (!files.profile) {
                // If light theme is active, background is white, else dark black
                const activeTheme = document.getElementById('theme').value;
                document.getElementById('result-before-viewport').src = activeTheme === 'light' 
                    ? '/static/assets/sample_portrait_1.png' // Or simple default UI
                    : '/static/assets/skull_placeholder.png';
            }

            updateMilestone(0, 'completed');
            updateMilestone(1, 'completed');
            updateMilestone(2, 'completed');
            updateMilestone(3, 'completed');
            statusText.textContent = "Breach successful!";

            // Delay presentation to showcase milestones
            setTimeout(() => {
                processingState.classList.add('hidden');
                successState.classList.remove('hidden');
                resetDragPosition();
                
                // Add to history list
                addToHistory(blob);
            }, 800);

        } catch (err) {
            alert(`Error: ${err.message}`);
            processingState.classList.add('hidden');
            awaitingState.classList.remove('hidden');
        } finally {
            checkEnableSubmit();
        }
    };

    invadeBtn.addEventListener('click', triggerInvasion);
    headerInvadeBtn.addEventListener('click', triggerInvasion);

    // Bind action panel downloads
    document.getElementById('download-trigger').addEventListener('click', () => {
        if (!resultBlobUrl) return;
        const a = document.createElement('a');
        a.href = resultBlobUrl;
        a.download = 'instagram_invaded_breach.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    document.getElementById('wa-share-trigger').addEventListener('click', () => {
        const text = encodeURIComponent("Check out this 3D Instagram pop-out meme I created using Instagram Invader AI! ⚡");
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    });

    document.getElementById('copy-share-trigger').addEventListener('click', (e) => {
        navigator.clipboard.writeText(window.location.origin).then(() => {
            const btn = document.getElementById('copy-share-trigger');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => btn.innerHTML = orig, 2000);
        });
    });
}

function resetMilestones() {
    for (let i = 0; i <= 3; i++) {
        const el = document.getElementById(`m-${i}`);
        el.className = 'milestone';
        el.querySelector('i').className = 'fa-solid fa-circle-notch';
    }
}

function updateMilestone(index, state) {
    const el = document.getElementById(`m-${index}`);
    if (!el) return;

    if (state === 'active') {
        el.className = 'milestone active';
        el.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
    } else if (state === 'completed') {
        el.className = 'milestone completed';
        el.querySelector('i').className = 'fa-solid fa-circle-check';
    }
}

// 7. Comparison Slider Logic
let isDragging = false;

function initComparisonSlider() {
    const slider = document.getElementById('comparison-slider');
    const handle = slider.querySelector('.comparison-drag-bar');
    const afterPane = slider.querySelector('.after-image-pane');

    const onStart = () => { isDragging = true; };
    const onEnd = () => { isDragging = false; };

    handle.addEventListener('mousedown', onStart);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('mousemove', (e) => handleDrag(e, slider, afterPane, handle));

    handle.addEventListener('touchstart', onStart);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchmove', (e) => handleDrag(e.touches[0], slider, afterPane, handle));
}

function handleDrag(e, slider, afterPane, handle) {
    if (!isDragging) return;

    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let percent = (x / rect.width) * 100;
    percent = Math.max(0, Math.min(percent, 100));

    afterPane.style.width = `${percent}%`;
    handle.style.left = `${percent}%`;
}

function resetDragPosition() {
    const slider = document.getElementById('comparison-slider');
    const handle = slider.querySelector('.comparison-drag-bar');
    const afterPane = slider.querySelector('.after-image-pane');

    afterPane.style.width = '50%';
    handle.style.left = '50%';
}

// 8. Local History Management (using downscaled thumbnail base64 in localStorage)
let historyItems = [];

function getHistoryKey() {
    const email = (window.currentUser && window.currentUser.email) ? window.currentUser.email : 'guest';
    return 'invader_history_' + email.replace(/[^a-zA-Z0-9]/g, '_');
}

function loadHistory() {
    try {
        const key = getHistoryKey();
        const stored = localStorage.getItem(key);
        if (stored) {
            historyItems = JSON.parse(stored);
        } else {
            historyItems = [];
        }
    } catch (e) {
        console.error("Failed to load local history", e);
        historyItems = [];
    }
}

function saveHistory() {
    try {
        const key = getHistoryKey();
        localStorage.setItem(key, JSON.stringify(historyItems));
    } catch (e) {
        console.error("Failed to save history items", e);
    }
}

// Expose history functions to window so auth.js can reload them on login/logout
window.loadHistory = loadHistory;
window.renderHistory = renderHistory;

function addToHistory(blob) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Create a small thumbnail to preserve localStorage quota
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxDim = 320;
            let w = img.width;
            let h = img.height;
            if (w > h) {
                if (w > maxDim) {
                    h = Math.round(h * maxDim / w);
                    w = maxDim;
                }
            } else {
                if (h > maxDim) {
                    w = Math.round(w * maxDim / h);
                    h = maxDim;
                }
            }
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            
            const thumbBase64 = canvas.toDataURL('image/jpeg', 0.8);
            const fullBase64 = e.target.result; // Full image to load when clicked

            const style = document.getElementById('tear_style').value;
            const theme = document.getElementById('theme').value;

            const item = {
                id: 'breach_' + Date.now(),
                timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                thumbnail: thumbBase64,
                full: fullBase64,
                style: style,
                theme: theme
            };

            // Insert at beginning
            historyItems.unshift(item);
            
            // Limit history to 15 items to avoid storage overflow
            if (historyItems.length > 15) {
                historyItems.pop();
            }

            saveHistory();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(blob);
}

function renderHistory() {
    const container = document.getElementById('history-grid-container');
    const emptyState = document.getElementById('history-empty-state');
    const grid = document.getElementById('history-items-grid');

    grid.innerHTML = '';

    if (historyItems.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    historyItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';
        
        card.innerHTML = `
            <div class="history-img-wrap" onclick="viewHistoryItem('${item.id}')">
                <img src="${item.thumbnail}" class="history-img" alt="Breach ${item.timestamp}">
            </div>
            <div class="history-card-details">
                <div>
                    <div class="history-date">${item.timestamp}</div>
                    <div style="font-size:0.7rem; color:var(--accent-pink); font-weight:600; text-transform:uppercase;">${item.style} - ${item.theme}</div>
                </div>
                <button type="button" class="delete-hist-btn" onclick="deleteHistoryItem('${item.id}', event)">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function deleteHistoryItem(id, event) {
    if (event) {
        event.stopPropagation();
    }
    historyItems = historyItems.filter(item => item.id !== id);
    saveHistory();
    renderHistory();
}

function viewHistoryItem(id) {
    const item = historyItems.find(i => i.id === id);
    if (!item) return;

    // Load full image back into sandbox comparison viewer
    document.getElementById('result-after-viewport').src = item.full;
    document.getElementById('result-before-viewport').src = item.theme === 'light' 
        ? '/static/assets/sample_portrait_1.png'
        : '/static/assets/skull_placeholder.png';

    // Switch result blob URL to let download action download this history item
    resultBlobUrl = item.full;

    // Direct to Dashboard tab to view
    switchTab('dashboard');

    // Make sure success view is showing in Sandbox
    document.getElementById('awaiting-state').classList.add('hidden');
    document.getElementById('processing-state').classList.add('hidden');
    document.getElementById('success-state').classList.remove('hidden');
    resetDragPosition();
}

// Bind Clear History action
document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (confirm("Are you sure you want to clear your breach history?")) {
        historyItems = [];
        saveHistory();
        renderHistory();
    }
});
