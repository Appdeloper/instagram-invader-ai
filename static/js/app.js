// Files State
let files = {
    portrait: null,
    profile: null
};

// Generated image blob URL holder
let resultBlobUrl = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initUploadDropzones();
    initPresets();
    initThemeToggle();
    initSliders();
    initFormSubmit();
    initBeforeAfterSlider();
});

// 1. Upload Dropzone Handling
function initUploadDropzones() {
    const dropzones = [
        { type: 'portrait', zoneId: 'portrait-dropzone', inputId: 'portrait-input' },
        { type: 'profile', zoneId: 'profile-dropzone', inputId: 'profile-input' }
    ];

    dropzones.forEach(({ type, zoneId, inputId }) => {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);

        // Click to open file browser
        zone.addEventListener('click', (e) => {
            // Prevent recursive click if clicking close button
            if (e.target.closest('.remove-btn')) return;
            input.click();
        });

        // File change
        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                handleFile(input.files[0], type);
            }
        });

        // Drag & drop events
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
                input.files = dt.files; // assign to input
                handleFile(file, type);
            }
        }, false);
    });
}

function handleFile(file, type) {
    files[type] = file;
    
    // Read and display preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImg = document.getElementById(`${type}-preview`);
        const previewContainer = previewImg.parentElement;
        
        previewImg.src = e.target.result;
        previewContainer.classList.remove('hidden');
        
        // If profile image is updated, also load it into the Before image slider
        if (type === 'profile') {
            document.getElementById('result-before-img').src = e.target.result;
        }

        checkEnableGenerate();
    };
    reader.readAsDataURL(file);
}

function removeFile(type) {
    files[type] = null;
    document.getElementById(`${type}-input`).value = '';
    
    const previewImg = document.getElementById(`${type}-preview`);
    const previewContainer = previewImg.parentElement;
    
    previewImg.src = '';
    previewContainer.classList.add('hidden');
    
    checkEnableGenerate();
}

function checkEnableGenerate() {
    const btn = document.getElementById('generate-btn');
    if (files.portrait && files.profile) {
        btn.removeAttribute('disabled');
    } else {
        btn.setAttribute('disabled', 'true');
    }
}

// 2. Tear Preset Selection
function initPresets() {
    const options = document.querySelectorAll('.preset-option');
    const hiddenInput = document.getElementById('tear_style');

    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            hiddenInput.value = opt.dataset.style;
        });
    });
}

// 3. Theme toggle
function initThemeToggle() {
    const buttons = document.querySelectorAll('.theme-btn');
    const hiddenInput = document.getElementById('theme');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            hiddenInput.value = btn.dataset.theme;
        });
    });
}

// 4. Sliders and text value feedback
function initSliders() {
    const slider = document.getElementById('intensity-slider');
    const valueLabel = document.getElementById('intensity-val');

    slider.addEventListener('input', (e) => {
        valueLabel.textContent = `${Math.round(e.target.value * 100)}%`;
    });
}

// 5. Submit Form & Handle Processing States
function initFormSubmit() {
    const form = document.getElementById('generator-form');
    const generateBtn = document.getElementById('generate-btn');
    
    const placeholderView = document.getElementById('placeholder-view');
    const loaderView = document.getElementById('loader-view');
    const resultView = document.getElementById('result-view');
    const statusText = document.querySelector('.loader-status');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!files.portrait || !files.profile) return;

        // Switch to loader view
        placeholderView.classList.add('hidden');
        resultView.classList.add('hidden');
        loaderView.classList.remove('hidden');
        generateBtn.setAttribute('disabled', 'true');

        // Reset loader steps
        resetLoaderSteps();
        
        // Step 0: Initializing
        updateLoaderStep(0, 'active');
        statusText.textContent = "Spinning up Flask engine...";

        // Assemble Form Payload
        const formData = new FormData(form);
        
        // Timing-based dummy step transitions to keep UX engaged
        // In real execution, these complete when backend returns. We update them dynamically.
        const stepIntervals = [
            setTimeout(() => {
                updateLoaderStep(0, 'completed');
                updateLoaderStep(1, 'active');
                statusText.textContent = "Removing background from portrait (rembg)...";
            }, 1000),
            setTimeout(() => {
                updateLoaderStep(1, 'completed');
                updateLoaderStep(2, 'active');
                statusText.textContent = "Procedurally ripping Instagram screenshot...";
            }, 3000),
            setTimeout(() => {
                updateLoaderStep(2, 'completed');
                updateLoaderStep(3, 'active');
                statusText.textContent = "Applying cinematic studio lighting & overlays...";
            }, 5500)
        ];

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                body: formData
            });

            // Cancel intervals
            stepIntervals.forEach(clearTimeout);

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error occurred during generation.');
            }

            // Successfully received binary PNG blob
            const blob = await response.blob();
            
            // Cleanup previous Object URL if exists
            if (resultBlobUrl) {
                URL.revokeObjectURL(resultBlobUrl);
            }
            
            resultBlobUrl = URL.createObjectURL(blob);
            
            // Set Result Image
            const resultAfterImg = document.getElementById('result-after-img');
            resultAfterImg.src = resultBlobUrl;
            
            // Trigger complete styling on loader steps
            updateLoaderStep(0, 'completed');
            updateLoaderStep(1, 'completed');
            updateLoaderStep(2, 'completed');
            updateLoaderStep(3, 'completed');
            statusText.textContent = "Composite complete!";

            // Delay showing results slightly to let user see completion state
            setTimeout(() => {
                loaderView.classList.add('hidden');
                resultView.classList.remove('hidden');
                resetSliderPosition();
            }, 600);

        } catch (error) {
            alert(`Oops: ${error.message}`);
            // Fallback back to placeholder
            loaderView.classList.add('hidden');
            placeholderView.classList.remove('hidden');
        } finally {
            checkEnableGenerate();
        }
    });

    // Share & Copy buttons
    document.getElementById('download-result-btn').addEventListener('click', () => {
        if (!resultBlobUrl) return;
        const a = document.createElement('a');
        a.href = resultBlobUrl;
        a.download = 'instagram_invader.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    document.getElementById('share-wa-btn').addEventListener('click', () => {
        const text = encodeURIComponent("Check out this hyper-realistic Instagram Invader AI meme I just generated! 🔥");
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    });

    document.getElementById('share-link-btn').addEventListener('click', (e) => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            const originalText = e.target.innerHTML;
            e.target.innerHTML = '<i class="fa-solid fa-check"></i> Link Copied!';
            setTimeout(() => {
                e.target.innerHTML = originalText;
            }, 2000);
        });
    });
}

function resetLoaderSteps() {
    for (let i = 0; i <= 3; i++) {
        const el = document.getElementById(`step-${i}`);
        el.className = 'step';
        const icon = el.querySelector('i');
        icon.className = i === 0 ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-notch';
    }
}

function updateLoaderStep(index, state) {
    const el = document.getElementById(`step-${index}`);
    if (!el) return;

    if (state === 'active') {
        el.className = 'step active';
        el.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
    } else if (state === 'completed') {
        el.className = 'step completed';
        el.querySelector('i').className = 'fa-solid fa-circle-check';
    }
}

// 6. Before / After Image Comparison Slider Interactivity
let isDraggingSlider = false;

function initBeforeAfterSlider() {
    const slider = document.getElementById('before-after-slider');
    const handle = slider.querySelector('.slider-handle');
    const afterSlide = slider.querySelector('.after-slide');

    const dragStart = () => { isDraggingSlider = true; };
    const dragEnd = () => { isDraggingSlider = false; };

    // Mouse Events
    handle.addEventListener('mousedown', dragStart);
    window.addEventListener('mouseup', dragEnd);
    window.addEventListener('mousemove', (e) => dragMove(e, slider, afterSlide, handle));

    // Touch Events
    handle.addEventListener('touchstart', dragStart);
    window.addEventListener('touchend', dragEnd);
    window.addEventListener('touchmove', (e) => dragMove(e.touches[0], slider, afterSlide, handle));
}

function dragMove(e, slider, afterSlide, handle) {
    if (!isDraggingSlider) return;

    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Bound slider percent between 0% and 100%
    let percentage = (x / rect.width) * 100;
    percentage = Math.max(0, Math.min(percentage, 100));

    // Update clipping width & handle position
    // Because after-slide overlays before-slide, we adjust the width of the overlay layer
    // Let the after-slide stretch from 0 to the divider. Since it sits on top,
    // if the percentage is 60%, the width of after-slide is 60% (showing left 60% as After, and right 40% as Before).
    // Wait, let's reverse it so left is Before (Original) and right is After (Composited) OR vice-versa.
    // In style.css, before-slide is z-index 1 (always back) and after-slide is z-index 2 (front, width: 50%).
    // So after-slide is the one that gets clipped. Since it sits on the left side, if it is 60% width,
    // it covers the left 60% of before-slide. That means left 60% is AFTER, right 40% is BEFORE.
    // To make it feel natural, we can map:
    // Left side = BEFORE (Original screenshot), Right side = AFTER (Breached).
    // Wait! If after-slide is on top, and its width is 50%, it covers the left half.
    // If after-slide is the AFTER (Breached) image, it shows on the left, and BEFORE on the right.
    // Let's check the HTML:
    // `.before-slide` contains the original image.
    // `.after-slide` contains the result.
    // If `.after-slide` is on top and has `width: 50%`, the left 50% is After (breached), right 50% is Before (original).
    // That means the user sees the Breach on the left and the Original on the right. That works perfectly!
    afterSlide.style.width = `${percentage}%`;
    handle.style.left = `${percentage}%`;
}

function resetSliderPosition() {
    const slider = document.getElementById('before-after-slider');
    const handle = slider.querySelector('.slider-handle');
    const afterSlide = slider.querySelector('.after-slide');
    
    afterSlide.style.width = '50%';
    handle.style.left = '50%';
}
