// Global Application State
let files = {
    portrait: null,
    profile: null
};

let resultBlobUrl = null;
let activeTab = 'dashboard';

// Cropper State Variables
let originalFile = null;
let originalImage = null;
let cropperRotation = 0;
let cropperFlipH = false;
let activeRatio = 'free';
let cropRect = { left: 0, top: 0, width: 0, height: 0 };
let scale = 1;
let canvasW = 0;
let canvasH = 0;

function getApiBaseUrl() {
    const hostname = window.location.hostname;
    let savedApiUrl = localStorage.getItem('invader_api_url');
    
    // Auto-migrate: If we are on GitHub Pages (not localhost) and the saved API URL 
    // points to insecure localhost (which will fail due to Mixed Content), clear it!
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        if (savedApiUrl === 'http://127.0.0.1:5000' || savedApiUrl === 'http://localhost:5000') {
            localStorage.removeItem('invader_api_url');
            savedApiUrl = null;
        }
    }

    if (savedApiUrl !== null) {
        return savedApiUrl;
    }
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return '';
    } else {
        return 'https://puny-crews-take.loca.lt';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initTabNavigation();
    initUploadDropzones();
    initPresets();
    initThemeSwitch();
    initResolutionSwitch();
    initGlowSlider();
    initInvadeActions();
    initComparisonSlider();
    loadHistory();
    initStitchToolkit();
    initSettings();
    initConnectionErrorModal();
    initProfileDropdownToggle();
    initPricingModal();
    initCropperModal();
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
    if (type === 'portrait') {
        openCropperModal(file);
        return;
    }

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

// 4b. Resolution Switch Toggle
function initResolutionSwitch() {
    const btns = document.querySelectorAll('.resolution-switch-btn');
    const resInput = document.getElementById('resolution');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            resInput.value = btn.dataset.res;
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

        // Smooth scroll to the sandbox container on mobile
        if (window.innerWidth <= 990) {
            const sandboxCard = document.querySelector('.sandbox-card');
            if (sandboxCard) {
                sandboxCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

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
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/generate`, {
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
                    ? 'static/assets/sample_portrait_1.png' // Or simple default UI
                    : 'static/assets/skull_placeholder.png';
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
            console.error("Invasion pipeline error:", err);
            processingState.classList.add('hidden');
            awaitingState.classList.remove('hidden');
            
            // Show custom connection error modal
            const connErrorModal = document.getElementById('connection-error-modal');
            if (connErrorModal) {
                connErrorModal.style.display = 'flex';
            } else {
                alert(`Error: ${err.message}`);
            }
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

    handle.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchmove', (e) => {
        if (isDragging) {
            if (e.cancelable) {
                e.preventDefault();
            }
            handleDrag(e.touches[0], slider, afterPane, handle);
        }
    }, { passive: false });
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
        ? 'static/assets/sample_portrait_1.png'
        : 'static/assets/skull_placeholder.png';

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

// 9. Google Stitch AI UI Toolkit
function initStitchToolkit() {
    const triggerBtn = document.getElementById('stitch-toolkit-trigger');
    const modal = document.getElementById('stitch-toolkit-modal');
    const closeBtn = document.getElementById('stitch-close-btn');
    
    if (!triggerBtn || !modal || !closeBtn) return;
    
    // Toggle Modal visibility
    triggerBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        populateTokensJSON();
    });
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Stitch tabs switching
    const tabs = modal.querySelectorAll('.stitch-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.stitchTab;
            
            // Toggle active class on buttons
            tabs.forEach(t => {
                if (t.dataset.stitchTab === targetTab) t.classList.add('active');
                else t.classList.remove('active');
            });
            
            // Toggle visibility of sections
            modal.querySelectorAll('.stitch-tab-content').forEach(content => {
                if (content.id === `stitch-content-${targetTab}`) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });
    });

    // Copy Design Tokens
    const copyTokensBtn = document.getElementById('copy-tokens-btn');
    if (copyTokensBtn) {
        copyTokensBtn.addEventListener('click', () => {
            const codeEl = document.getElementById('tokens-json-display');
            navigator.clipboard.writeText(codeEl.textContent).then(() => {
                const origText = copyTokensBtn.innerHTML;
                copyTokensBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyTokensBtn.style.background = 'var(--accent-cyan)';
                setTimeout(() => {
                    copyTokensBtn.innerHTML = origText;
                    copyTokensBtn.style.background = '';
                }, 2000);
            });
        });
    }

    // Copy Vibe Prompts
    const copyPromptBtns = modal.querySelectorAll('.copy-prompt-btn');
    copyPromptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const promptId = btn.dataset.promptId;
            const textEl = document.getElementById(`${promptId}-text`);
            if (textEl) {
                navigator.clipboard.writeText(textEl.textContent).then(() => {
                    const origText = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    btn.style.background = 'var(--accent-pink)';
                    setTimeout(() => {
                        btn.innerHTML = origText;
                        btn.style.background = '';
                    }, 2000);
                });
            }
        });
    });

    // Sandbox Playground Rendering
    const applyBtn = document.getElementById('apply-sandbox-btn');
    const textInput = document.getElementById('sandbox-code-input');
    const previewFrame = document.getElementById('sandbox-preview-frame');

    if (applyBtn && textInput && previewFrame) {
        applyBtn.addEventListener('click', () => {
            const rawHTML = textInput.value.trim();
            if (!rawHTML) {
                previewFrame.innerHTML = '<div class="empty-sandbox-tip">Paste Stitch-generated HTML on the left and click "Render" to preview here.</div>';
                return;
            }
            
            // Inject user-pasted HTML safely in the preview zone
            previewFrame.innerHTML = rawHTML;
            
            // If they paste scripts or class elements, let's keep them styled appropriately
            const scripts = previewFrame.querySelectorAll('script');
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    newScript.textContent = script.textContent;
                }
                document.body.appendChild(newScript).parentNode.removeChild(newScript);
            });
        });
    }
}

// Function to load and format design tokens JSON
function populateTokensJSON() {
    const jsonDisplay = document.getElementById('tokens-json-display');
    if (!jsonDisplay) return;
    
    const tokens = {
        "name": "Instagram Invader AI",
        "aesthetic": "Cinematic Dark Mode / Glassmorphism",
        "colors": {
            "background": "#0a0612",
            "surface_card": "rgba(18, 12, 28, 0.75)",
            "accent_pink": "#d946ef",
            "accent_purple": "#a855f7",
            "accent_cyan": "#06b6d4",
            "border_glass": "rgba(255, 255, 255, 0.08)",
            "text_main": "#f8fafc",
            "text_muted": "#94a3b8"
        },
        "fonts": {
            "headers": "Poppins",
            "body": "Outfit"
        },
        "shadows": {
            "pink_glow": "0 0 20px rgba(217, 70, 239, 0.5)",
            "cyan_glow": "0 0 20px rgba(6, 182, 212, 0.5)"
        },
        "layouts": {
            "max_width": "1280px",
            "card_radius": "24px",
            "button_radius": "12px"
        }
    };
    
    jsonDisplay.textContent = JSON.stringify(tokens, null, 4);
}

// 10. Application Settings Manager
function initSettings() {
    const triggerBtn = document.getElementById('settings-trigger-btn');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close-btn');
    const cancelBtn = document.getElementById('settings-cancel-btn');
    const saveBtn = document.getElementById('settings-save-btn');
    const apiUrlInput = document.getElementById('settings-api-url');
    const authModeSelect = document.getElementById('settings-auth-mode');
    const firebaseGroup = document.getElementById('settings-firebase-group');
    const firebaseConfigInput = document.getElementById('settings-firebase-config');

    if (!modal) return;

    // Helper to extract JSON from raw paste input (handles JSON, JS objects, variable declarations)
    const parseFirebaseConfig = (input) => {
        const trimmed = input.trim();
        if (!trimmed) return null;

        // Try direct JSON parsing
        try {
            return JSON.parse(trimmed);
        } catch (e) {}

        // Match key-value regex to pull from config object format
        const config = {};
        const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
        let matchedKeysCount = 0;

        keys.forEach(key => {
            const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`);
            const match = trimmed.match(regex);
            if (match && match[1]) {
                config[key] = match[1];
                matchedKeysCount++;
            }
        });

        if (matchedKeysCount > 0) {
            return config;
        }

        throw new Error("Could not parse config. Check that your configuration contains at least 'apiKey' and 'appId'.");
    };

    const updateFirebaseGroupVisibility = () => {
        if (authModeSelect.value === 'firebase') {
            if (firebaseGroup) firebaseGroup.style.display = 'block';
        } else {
            if (firebaseGroup) firebaseGroup.style.display = 'none';
        }
    };

    if (authModeSelect) {
        authModeSelect.addEventListener('change', updateFirebaseGroupVisibility);
    }

    // Helper function to toggle modal
    const toggleModal = (show) => {
        if (show) {
            // Load current settings values into inputs
            apiUrlInput.value = localStorage.getItem('invader_api_url') || '';
            authModeSelect.value = localStorage.getItem('invader_auth_mode') || 'mock';
            
            const savedFirebaseConfig = localStorage.getItem('invader_firebase_config');
            if (savedFirebaseConfig && firebaseConfigInput) {
                try {
                    firebaseConfigInput.value = JSON.stringify(JSON.parse(savedFirebaseConfig), null, 2);
                } catch (e) {
                    firebaseConfigInput.value = savedFirebaseConfig;
                }
            } else if (firebaseConfigInput) {
                firebaseConfigInput.value = '';
            }

            updateFirebaseGroupVisibility();
            modal.style.display = 'flex';
        } else {
            modal.style.display = 'none';
        }
    };

    if (triggerBtn) {
        triggerBtn.addEventListener('click', () => toggleModal(true));
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleModal(false));
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => toggleModal(false));
    }

    // Close when clicking overlay background
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            toggleModal(false);
        }
    });

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const newUrl = apiUrlInput.value.trim();
            const newAuthMode = authModeSelect.value;
            let finalFirebaseConfig = null;

            if (newAuthMode === 'firebase' && firebaseConfigInput) {
                const rawConfigValue = firebaseConfigInput.value.trim();
                if (!rawConfigValue) {
                    alert("Please provide your Firebase Configuration parameters for Firebase Auth Mode.");
                    return;
                }
                try {
                    finalFirebaseConfig = parseFirebaseConfig(rawConfigValue);
                } catch (err) {
                    alert("Error parsing Firebase configuration:\n" + err.message + "\n\nPlease copy-paste the exact config block from your Firebase Console.");
                    return;
                }
            }

            // Save to localStorage
            if (newUrl) {
                localStorage.setItem('invader_api_url', newUrl);
            } else {
                localStorage.removeItem('invader_api_url');
            }

            localStorage.setItem('invader_auth_mode', newAuthMode);

            if (newAuthMode === 'firebase' && finalFirebaseConfig) {
                localStorage.setItem('invader_firebase_config', JSON.stringify(finalFirebaseConfig));
            } else {
                localStorage.removeItem('invader_firebase_config');
            }

            // Reload page to apply new configurations
            window.location.reload();
        });
    }
}

// 10b. Connection Troubleshooting Modal Manager
function initConnectionErrorModal() {
    const modal = document.getElementById('connection-error-modal');
    const closeBtn = document.getElementById('conn-error-close-btn');
    const cancelBtn = document.getElementById('conn-error-cancel-btn');
    const settingsBtn = document.getElementById('conn-error-settings-btn');
    const settingsModal = document.getElementById('settings-modal');

    if (!modal) return;

    const hideModal = () => {
        modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            hideModal();
            // Open the settings modal by clicking the trigger button
            const settingsTrigger = document.getElementById('settings-trigger-btn');
            if (settingsTrigger) {
                settingsTrigger.click();
            } else if (settingsModal) {
                settingsModal.style.display = 'flex';
            }
        });
    }

    // Close when clicking overlay background
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
}

// Global copy function for the connection error commands
window.copyConnCode = function(elementId, buttonEl) {
    const codeEl = document.getElementById(elementId);
    if (!codeEl) return;
    
    const text = codeEl.textContent || codeEl.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = buttonEl.innerHTML;
        buttonEl.innerHTML = '<i class="fa-solid fa-check" style="color: var(--accent-cyan);"></i>';
        setTimeout(() => {
            buttonEl.innerHTML = originalHTML;
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy code: ", err);
    });
};


// 11. Profile Dropdown Click Toggle for Touch and Desktop
function initProfileDropdownToggle() {
    const profileWidget = document.getElementById('profile-widget');
    if (profileWidget) {
        profileWidget.addEventListener('click', (e) => {
            if (!e.target.closest('.profile-dropdown')) {
                profileWidget.classList.toggle('active');
                e.stopPropagation();
            }
        });

        document.addEventListener('click', () => {
            profileWidget.classList.remove('active');
        });
    }
}

// 12. Pricing Modal Toggle logic
function initPricingModal() {
    const triggerBtn = document.getElementById('header-pricing-btn');
    const modal = document.getElementById('pricing-modal');
    const closeBtn = document.getElementById('pricing-close-btn');

    if (!modal) return;

    if (triggerBtn) {
        triggerBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            const profileWidget = document.getElementById('profile-widget');
            if (profileWidget) {
                profileWidget.classList.remove('active');
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// 13. Image Cropper canvas operations and controls logic
function openCropperModal(file) {
    originalFile = file;
    cropperRotation = 0;
    cropperFlipH = false;
    activeRatio = 'free';
    
    // Set active ratio buttons state
    document.querySelectorAll('.aspect-ratio-btn').forEach(btn => {
        if (btn.dataset.ratio === 'free') btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            const cropperModal = document.getElementById('cropper-modal');
            if (cropperModal) {
                cropperModal.style.display = 'flex';
                renderCropperCanvas();
                initInitialCropBox();
            }
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function renderCropperCanvas() {
    if (!originalImage) return;

    const canvas = document.getElementById('cropper-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const imgW = originalImage.width;
    const imgH = originalImage.height;

    // Calculate display dimensions based on rotation
    const isRotated90 = (cropperRotation % 180 === 90);
    const targetW = isRotated90 ? imgH : imgW;
    const targetH = isRotated90 ? imgW : imgH;

    // Get max display bounds from cropper workspace container width/height
    const workspace = document.querySelector('.cropper-workspace');
    if (!workspace) return;
    
    const maxW = Math.min(500, workspace.clientWidth - 40);
    const maxH = 320; 

    scale = Math.min(maxW / targetW, maxH / targetH);
    canvasW = targetW * scale;
    canvasH = targetH * scale;

    canvas.width = canvasW;
    canvas.height = canvasH;

    // Set container dimension to wrap canvas perfectly
    const container = document.getElementById('cropper-canvas-container');
    if (container) {
        container.style.width = `${canvasW}px`;
        container.style.height = `${canvasH}px`;
    }

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();
    
    // Move to center of canvas
    ctx.translate(canvasW / 2, canvasH / 2);
    
    // Apply scale, rotate, flip in correct sequence
    ctx.scale(scale, scale);
    ctx.rotate((cropperRotation * Math.PI) / 180);
    
    if (cropperFlipH) {
        ctx.scale(-1, 1);
    }

    // Draw centering the image
    ctx.drawImage(originalImage, -imgW / 2, -imgH / 2, imgW, imgH);
    ctx.restore();
}

function initInitialCropBox() {
    let width, height;
    
    if (activeRatio === 'free') {
        width = canvasW * 0.8;
        height = canvasH * 0.8;
    } else if (activeRatio === '1:1') {
        const size = Math.min(canvasW, canvasH) * 0.8;
        width = size;
        height = size;
    } else if (activeRatio === '4:5') {
        // w/h = 4/5 => width = height * 0.8
        height = Math.min(canvasH, canvasW / 0.8) * 0.8;
        width = height * 0.8;
    } else if (activeRatio === '16:9') {
        // w/h = 16/9 => height = width * 9/16
        width = Math.min(canvasW, canvasH * (16 / 9)) * 0.8;
        height = width * (9 / 16);
    }

    cropRect = {
        left: (canvasW - width) / 2,
        top: (canvasH - height) / 2,
        width: width,
        height: height
    };

    updateOverlayDOM();
}

function updateOverlayDOM() {
    const overlay = document.querySelector('.cropper-grid-overlay');
    if (!overlay) return;
    
    overlay.style.left = `${cropRect.left}px`;
    overlay.style.top = `${cropRect.top}px`;
    overlay.style.width = `${cropRect.width}px`;
    overlay.style.height = `${cropRect.height}px`;
    
    updateHandles();
}

function updateHandles() {
    const tl = document.querySelector('.handle-tl');
    const tr = document.querySelector('.handle-tr');
    const bl = document.querySelector('.handle-bl');
    const br = document.querySelector('.handle-br');
    
    if (!tl || !tr || !bl || !br) return;

    const top = cropRect.top;
    const left = cropRect.left;
    const w = cropRect.width;
    const h = cropRect.height;
    
    tl.style.top = `${top - 8}px`;
    tl.style.left = `${left - 8}px`;
    
    tr.style.top = `${top - 8}px`;
    tr.style.left = `${left + w - 8}px`;
    
    bl.style.top = `${top + h - 8}px`;
    bl.style.left = `${left - 8}px`;
    
    br.style.top = `${top + h - 8}px`;
    br.style.left = `${left + w - 8}px`;
}

function initCropperModal() {
    const modal = document.getElementById('cropper-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('cropper-close-btn');
    const cancelBtn = document.getElementById('cropper-cancel-btn');
    const applyBtn = document.getElementById('cropper-apply-btn');

    const rotLeft = document.getElementById('cropper-rot-left');
    const rotRight = document.getElementById('cropper-rot-right');
    const flipHBtn = document.getElementById('cropper-flip-h');

    const ratioBtns = document.querySelectorAll('.aspect-ratio-btn');

    // Close & Cancel
    const closeModal = () => {
        modal.style.display = 'none';
        originalFile = null;
        originalImage = null;
        // Clean up input value so same file can be uploaded again
        const input = document.getElementById('portrait-input');
        if (input) input.value = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Rotation controls
    if (rotLeft) {
        rotLeft.addEventListener('click', () => {
            cropperRotation = (cropperRotation - 90 + 360) % 360;
            renderCropperCanvas();
            initInitialCropBox();
        });
    }

    if (rotRight) {
        rotRight.addEventListener('click', () => {
            cropperRotation = (cropperRotation + 90) % 360;
            renderCropperCanvas();
            initInitialCropBox();
        });
    }

    // Flip controls
    if (flipHBtn) {
        flipHBtn.addEventListener('click', () => {
            cropperFlipH = !cropperFlipH;
            renderCropperCanvas();
            initInitialCropBox();
        });
    }

    // Aspect Ratio controls
    ratioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ratioBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeRatio = btn.dataset.ratio;
            initInitialCropBox();
        });
    });

    // Dragging and resizing box handlers
    let isDraggingBox = false;
    let isResizingBox = false;
    let currentHandle = null;
    let startMouseX = 0;
    let startMouseY = 0;
    let startCropRect = {};

    const overlay = document.querySelector('.cropper-grid-overlay');

    if (overlay) {
        overlay.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('cropper-drag-handle')) return;
            isDraggingBox = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startCropRect = { ...cropRect };
            e.preventDefault();
        });

        overlay.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('cropper-drag-handle')) return;
            isDraggingBox = true;
            startMouseX = e.touches[0].clientX;
            startMouseY = e.touches[0].clientY;
            startCropRect = { ...cropRect };
        }, { passive: true });
    }

    const handles = document.querySelectorAll('.cropper-drag-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizingBox = true;
            currentHandle = handle.dataset.handle;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startCropRect = { ...cropRect };
            e.preventDefault();
            e.stopPropagation();
        });

        handle.addEventListener('touchstart', (e) => {
            isResizingBox = true;
            currentHandle = handle.dataset.handle;
            startMouseX = e.touches[0].clientX;
            startMouseY = e.touches[0].clientY;
            startCropRect = { ...cropRect };
            e.stopPropagation();
        }, { passive: true });
    });

    // Move & Resize calculations on move
    const handleMove = (clientX, clientY, e) => {
        if (!isDraggingBox && !isResizingBox) return;

        const dx = clientX - startMouseX;
        const dy = clientY - startMouseY;

        if (isDraggingBox) {
            let newLeft = startCropRect.left + dx;
            let newTop = startCropRect.top + dy;
            
            newLeft = Math.max(0, Math.min(newLeft, canvasW - startCropRect.width));
            newTop = Math.max(0, Math.min(newTop, canvasH - startCropRect.height));
            
            cropRect.left = newLeft;
            cropRect.top = newTop;
        } else if (isResizingBox) {
            let ratioVal = null;
            if (activeRatio === '1:1') ratioVal = 1;
            else if (activeRatio === '4:5') ratioVal = 0.8;
            else if (activeRatio === '16:9') ratioVal = 16 / 9;

            if (ratioVal === null) {
                // Free aspect ratio resize
                if (currentHandle === 'br') {
                    let newW = startCropRect.width + dx;
                    let newH = startCropRect.height + dy;
                    cropRect.width = Math.max(30, Math.min(newW, canvasW - startCropRect.left));
                    cropRect.height = Math.max(30, Math.min(newH, canvasH - startCropRect.top));
                } else if (currentHandle === 'tr') {
                    let newW = startCropRect.width + dx;
                    let newH = startCropRect.height - dy;
                    let newTop = startCropRect.top + dy;
                    if (newTop >= 0 && newH >= 30) {
                        cropRect.width = Math.max(30, Math.min(newW, canvasW - startCropRect.left));
                        cropRect.top = newTop;
                        cropRect.height = newH;
                    }
                } else if (currentHandle === 'bl') {
                    let newW = startCropRect.width - dx;
                    let newH = startCropRect.height + dy;
                    let newLeft = startCropRect.left + dx;
                    if (newLeft >= 0 && newW >= 30) {
                        cropRect.left = newLeft;
                        cropRect.width = newW;
                        cropRect.height = Math.max(30, Math.min(newH, canvasH - startCropRect.top));
                    }
                } else if (currentHandle === 'tl') {
                    let newW = startCropRect.width - dx;
                    let newH = startCropRect.height - dy;
                    let newLeft = startCropRect.left + dx;
                    let newTop = startCropRect.top + dy;
                    if (newLeft >= 0 && newW >= 30 && newTop >= 0 && newH >= 30) {
                        cropRect.left = newLeft;
                        cropRect.width = newW;
                        cropRect.top = newTop;
                        cropRect.height = newH;
                    }
                }
            } else {
                // Aspect Ratio locked resize
                if (currentHandle === 'br') {
                    let newW = startCropRect.width + dx;
                    let newH = newW / ratioVal;
                    
                    const maxW = canvasW - startCropRect.left;
                    const maxH = canvasH - startCropRect.top;
                    
                    if (newW > maxW || newH > maxH) {
                        newW = Math.min(newW, maxW, maxH * ratioVal);
                        newH = newW / ratioVal;
                    }
                    if (newW >= 30 && newH >= 30) {
                        cropRect.width = newW;
                        cropRect.height = newH;
                    }
                } else if (currentHandle === 'tr') {
                    let newW = startCropRect.width + dx;
                    let newH = newW / ratioVal;
                    let newTop = startCropRect.top - (newH - startCropRect.height);
                    
                    const maxW = canvasW - startCropRect.left;
                    
                    if (newW > maxW || newTop < 0) {
                        newW = Math.min(newW, maxW, (startCropRect.top + startCropRect.height) * ratioVal);
                        newH = newW / ratioVal;
                        newTop = startCropRect.top + startCropRect.height - newH;
                    }
                    if (newW >= 30 && newH >= 30 && newTop >= 0) {
                        cropRect.width = newW;
                        cropRect.height = newH;
                        cropRect.top = newTop;
                    }
                } else if (currentHandle === 'bl') {
                    let newW = startCropRect.width - dx;
                    let newH = newW / ratioVal;
                    let newLeft = startCropRect.left + dx;
                    
                    const maxW = startCropRect.left + startCropRect.width;
                    const maxH = canvasH - startCropRect.top;
                    
                    if (newW > maxW || newH > maxH) {
                        newW = Math.min(newW, maxW, maxH * ratioVal);
                        newH = newW / ratioVal;
                        newLeft = startCropRect.left + startCropRect.width - newW;
                    }
                    if (newW >= 30 && newH >= 30 && newLeft >= 0) {
                        cropRect.width = newW;
                        cropRect.height = newH;
                        cropRect.left = newLeft;
                    }
                } else if (currentHandle === 'tl') {
                    let newW = startCropRect.width - dx;
                    let newH = newW / ratioVal;
                    let newLeft = startCropRect.left + dx;
                    let newTop = startCropRect.top - (newH - startCropRect.height);
                    
                    const maxW = startCropRect.left + startCropRect.width;
                    const maxH = startCropRect.top + startCropRect.height;
                    
                    if (newW > maxW || newTop < 0) {
                        newW = Math.min(newW, maxW, (startCropRect.top + startCropRect.height) * ratioVal);
                        newH = newW / ratioVal;
                        newLeft = startCropRect.left + startCropRect.width - newW;
                        newTop = startCropRect.top + startCropRect.height - newH;
                    }
                    if (newW >= 30 && newH >= 30 && newLeft >= 0 && newTop >= 0) {
                        cropRect.width = newW;
                        cropRect.height = newH;
                        cropRect.left = newLeft;
                        cropRect.top = newTop;
                    }
                }
            }
        }
        updateOverlayDOM();
    };

    window.addEventListener('mousemove', (e) => {
        handleMove(e.clientX, e.clientY, e);
    });

    window.addEventListener('touchmove', (e) => {
        if (isDraggingBox || isResizingBox) {
            if (e.cancelable) e.preventDefault();
            handleMove(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    }, { passive: false });

    const handleEnd = () => {
        isDraggingBox = false;
        isResizingBox = false;
    };

    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);

    // Apply Crop button click
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (!originalImage) return;

            const imgW = originalImage.width;
            const imgH = originalImage.height;

            const isRotated90 = (cropperRotation % 180 === 90);
            const targetW = isRotated90 ? imgH : imgW;
            const targetH = isRotated90 ? imgW : imgH;

            // 1. Create a full high-resolution oriented canvas
            const orientedCanvas = document.createElement('canvas');
            orientedCanvas.width = targetW;
            orientedCanvas.height = targetH;
            
            const oCtx = orientedCanvas.getContext('2d');
            oCtx.save();
            oCtx.translate(targetW / 2, targetH / 2);
            oCtx.rotate((cropperRotation * Math.PI) / 180);
            if (cropperFlipH) {
                oCtx.scale(-1, 1);
            }
            oCtx.drawImage(originalImage, -imgW / 2, -imgH / 2, imgW, imgH);
            oCtx.restore();

            // 2. Map screen canvas crop coordinates back to high resolution
            const highResScale = 1 / scale;
            const cropX = cropRect.left * highResScale;
            const cropY = cropRect.top * highResScale;
            const finalWidth = cropRect.width * highResScale;
            const finalHeight = cropRect.height * highResScale;

            // 3. Create high-resolution cropped canvas
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = finalWidth;
            cropCanvas.height = finalHeight;

            const cCtx = cropCanvas.getContext('2d');
            cCtx.drawImage(
                orientedCanvas,
                cropX, cropY, finalWidth, finalHeight,
                0, 0, finalWidth, finalHeight
            );

            // 4. Output the cropped image as blob
            cropCanvas.toBlob((blob) => {
                const filename = originalFile.name || 'cropped_portrait.png';
                const croppedFile = new File([blob], filename, { type: 'image/png' });
                
                // Save to files.portrait state
                files.portrait = croppedFile;

                // Update Preview
                const previewContainer = document.getElementById('portrait-preview-container');
                const previewImg = document.getElementById('portrait-preview-img');
                previewImg.src = URL.createObjectURL(croppedFile);
                previewContainer.classList.remove('hidden');

                checkEnableSubmit();
                closeModal();
            }, 'image/png');
        });
    }
}

