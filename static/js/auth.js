/**
 * Authentication Management Script for Instagram Invader AI
 * Handles Firebase Auth (Email/Password & Google) and dynamic DOM states.
 */

// Global state for authentication
window.currentUser = null;

// Mock database key for localStorage
const MOCK_USERS_KEY = 'invader_mock_users';

document.addEventListener('DOMContentLoaded', () => {
    initAuthentication();
});

function initAuthentication() {
    // 1. Initialize Firebase if mock auth is disabled
    if (!window.USE_MOCK_AUTH) {
        try {
            firebase.initializeApp(window.firebaseConfig);
            if (typeof firebase.analytics === 'function') {
                firebase.analytics();
            }
            
            // Listen to real auth state changes
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    const pendingName = sessionStorage.getItem('invader_pending_display_name');
                    onLoginSuccess({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || pendingName || user.email.split('@')[0],
                        photoURL: user.photoURL || 'static/assets/skull_placeholder.png'
                    });
                } else {
                    onLogoutSuccess();
                }
            });
        } catch (error) {
            console.error("Firebase initialization failed. Falling back to mock auth.", error);
            window.USE_MOCK_AUTH = true;
            setupMockAuth();
        }
    } else {
        setupMockAuth();
    }

    // 2. Setup Form event listeners & DOM bindings
    setupAuthUIEvents();
}

/**
 * Setup Mock Authentication logic and persist sessions locally
 */
function setupMockAuth() {
    console.log("⚡ Running in MOCK AUTH MODE. Firebase credentials not required.");
    
    // Check if session exists in localStorage
    const savedSession = localStorage.getItem('invader_mock_session');
    if (savedSession) {
        try {
            onLoginSuccess(JSON.parse(savedSession));
        } catch (e) {
            onLogoutSuccess();
        }
    } else {
        onLogoutSuccess();
    }
}

/**
 * Hook up UI interactions: tab switching, passwords eye icons, buttons, forms
 */
function setupAuthUIEvents() {
    const authOverlay = document.getElementById('auth-overlay');
    if (!authOverlay) return;

    // A. Switch between Sign In and Sign Up modes
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('login-form-wrapper');
    const signupForm = document.getElementById('signup-form-wrapper');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const mode = tab.dataset.mode;
            if (mode === 'signin') {
                loginForm.classList.remove('hidden');
                signupForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                signupForm.classList.remove('hidden');
            }
            clearAuthAlerts();
        });
    });

    // B. Eye icon password visibility toggle
    const togglePasswordButtons = document.querySelectorAll('.toggle-password-btn');
    togglePasswordButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    });

    // C. Form submissions
    const loginFormEl = document.getElementById('login-form');
    const signupFormEl = document.getElementById('signup-form');

    if (loginFormEl) {
        loginFormEl.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = loginFormEl.querySelector('.auth-submit-btn');
            handleEmailLogin(submitBtn);
        });
    }

    if (signupFormEl) {
        signupFormEl.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = signupFormEl.querySelector('.auth-submit-btn');
            handleEmailSignup(submitBtn);
        });
    }

    // D. Google Sign-in Buttons
    const googleButtons = document.querySelectorAll('.google-signin-btn');
    googleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            handleGoogleSignIn(btn);
        });
    });

    // E. Header Logout button
    const logoutBtn = document.getElementById('header-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            handleSignOut();
        });
    }
}

/**
 * Handle Login with Email and Password
 */
function handleEmailLogin(submitBtn = null) {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showAuthAlert('login-alert', 'Please enter your email and password.', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthAlert('login-alert', 'Please enter a valid email address.', 'error');
        return;
    }

    setAuthLoading(true, submitBtn);

    if (window.USE_MOCK_AUTH) {
        // Validate against mock database in localStorage
        setTimeout(() => {
            const users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (!user) {
                setAuthLoading(false);
                showAuthAlert('login-alert', 'Account not found. Switch to Register to create one.', 'error');
                return;
            }

            if (user.password !== password) {
                setAuthLoading(false);
                showAuthAlert('login-alert', 'Incorrect password.', 'error');
                return;
            }

            // Success Mock Login
            const userData = {
                uid: 'mock_' + Date.now(),
                email: user.email,
                displayName: user.name || user.email.split('@')[0],
                photoURL: 'static/assets/skull_placeholder.png'
            };
            localStorage.setItem('invader_mock_session', JSON.stringify(userData));
            onLoginSuccess(userData);
            setAuthLoading(false);
        }, 800);
    } else {
        // Real Firebase login
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                setAuthLoading(false);
                // Auth change listener handles UI change
            })
            .catch((error) => {
                setAuthLoading(false);
                showAuthAlert('login-alert', error.message, 'error');
            });
    }
}

/**
 * Handle Registration with Name, Email and Password
 */
function handleEmailSignup(submitBtn = null) {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!name || !email || !password) {
        showAuthAlert('signup-alert', 'All fields are required.', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthAlert('signup-alert', 'Please enter a valid email address.', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthAlert('signup-alert', 'Password must be at least 6 characters.', 'error');
        return;
    }

    // Set pending name for real Firebase sign up profile sync
    if (!window.USE_MOCK_AUTH) {
        sessionStorage.setItem('invader_pending_display_name', name);
    }

    setAuthLoading(true, submitBtn);

    if (window.USE_MOCK_AUTH) {
        setTimeout(() => {
            const users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
            const userExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());

            if (userExists) {
                setAuthLoading(false);
                showAuthAlert('signup-alert', 'Email already registered. Try logging in.', 'error');
                return;
            }

            // Save to mock DB
            users.push({ name, email, password });
            localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));

            // Success Mock Login instantly
            const userData = {
                uid: 'mock_' + Date.now(),
                email: email,
                displayName: name,
                photoURL: 'static/assets/skull_placeholder.png'
            };
            localStorage.setItem('invader_mock_session', JSON.stringify(userData));
            onLoginSuccess(userData);
            setAuthLoading(false);
        }, 1000);
    } else {
        // Real Firebase registration
        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Update profile display name
                return userCredential.user.updateProfile({
                    displayName: name
                });
            })
            .then(() => {
                setAuthLoading(false);
                // Auth change listener handles UI change
            })
            .catch((error) => {
                setAuthLoading(false);
                showAuthAlert('signup-alert', error.message, 'error');
            });
    }
}

/**
 * Handle Google Single Sign-In
 */
function handleGoogleSignIn(btn = null) {
    setAuthLoading(true, btn);

    if (window.USE_MOCK_AUTH) {
        // Trigger a nice mock popup simulation
        setTimeout(() => {
            const userData = {
                uid: 'google_mock_' + Math.floor(Math.random() * 100000),
                email: 'google.guest@example.com',
                displayName: 'Guest Invader',
                photoURL: 'static/assets/skull_placeholder.png'
            };
            localStorage.setItem('invader_mock_session', JSON.stringify(userData));
            onLoginSuccess(userData);
            setAuthLoading(false);
        }, 1000);
    } else {
        // Real Firebase Google popup
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                setAuthLoading(false);
                // Auth change listener handles UI change
            })
            .catch((error) => {
                setAuthLoading(false);
                showAuthAlert('login-alert', error.message, 'error');
                showAuthAlert('signup-alert', error.message, 'error');
            });
    }
}

/**
 * Handle Logging Out
 */
function handleSignOut() {
    if (window.USE_MOCK_AUTH) {
        localStorage.removeItem('invader_mock_session');
        onLogoutSuccess();
    } else {
        firebase.auth().signOut().then(() => {
            onLogoutSuccess();
        }).catch((error) => {
            console.error("Firebase SignOut error: ", error);
        });
    }
}

/**
 * Transition DOM state upon successful login
 */
function onLoginSuccess(user) {
    window.currentUser = user;
    console.log("Logged in user:", user);

    // Remove pending signup display name
    sessionStorage.removeItem('invader_pending_display_name');

    // 1. Set values in user profile header widget
    const userAvatarImg = document.getElementById('user-avatar-img');
    const userNameTxt = document.getElementById('user-name-text');
    const userEmailTxt = document.getElementById('user-email-text');

    if (userAvatarImg) userAvatarImg.src = user.photoURL;
    if (userNameTxt) userNameTxt.innerText = user.displayName;
    if (userEmailTxt) userEmailTxt.innerText = user.email;

    // Reveal user widget
    const profileWidget = document.getElementById('profile-widget');
    if (profileWidget) profileWidget.classList.remove('hidden');

    // 2. Hide Login Overlay with animation
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) {
        authOverlay.classList.add('fade-out');
        setTimeout(() => {
            authOverlay.style.display = 'none';
            authOverlay.classList.remove('fade-out');
        }, 400); // matches CSS transitions
    }

    // 3. Reload and render history for this user
    if (typeof window.loadHistory === 'function') {
        window.loadHistory();
    }
    if (typeof window.renderHistory === 'function') {
        window.renderHistory();
    }
}

/**
 * Transition DOM state upon logging out
 */
function onLogoutSuccess() {
    window.currentUser = null;
    
    // Hide user header widget
    const profileWidget = document.getElementById('profile-widget');
    if (profileWidget) profileWidget.classList.add('hidden');

    // Reveal auth overlay
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) {
        authOverlay.style.display = 'flex';
    }

    // Reload and render history for guest user
    if (typeof window.loadHistory === 'function') {
        window.loadHistory();
    }
    if (typeof window.renderHistory === 'function') {
        window.renderHistory();
    }
}

/**
 * Utility: show error or warning messages in forms
 */
function showAuthAlert(elementId, message, type = 'error') {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) return;

    alertDiv.className = `auth-alert ${type}`;
    alertDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${message}</span>`;
    alertDiv.style.display = 'flex';
}

/**
 * Utility: clear forms errors
 */
function clearAuthAlerts() {
    const alerts = document.querySelectorAll('.auth-alert');
    alerts.forEach(a => {
        a.style.display = 'none';
        a.innerHTML = '';
    });
}

/**
 * Utility: Show spinner overlay inside forms while waiting
 */
function setAuthLoading(isLoading, targetButton = null) {
    const spinners = document.querySelectorAll('.auth-card-spinner');
    spinners.forEach(s => {
        s.classList.add('hidden');
    });

    const submitBtns = document.querySelectorAll('.auth-submit-btn, .google-signin-btn');
    submitBtns.forEach(btn => {
        if (isLoading) {
            btn.setAttribute('disabled', 'true');
            btn.style.opacity = '0.7';
            btn.style.pointerEvents = 'none';
        } else {
            btn.removeAttribute('disabled');
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            const googleLogo = btn.querySelector('img');
            if (googleLogo) googleLogo.style.display = 'block';
        }
    });

    if (isLoading) {
        if (targetButton) {
            const spinner = targetButton.querySelector('.auth-card-spinner');
            if (spinner) spinner.classList.remove('hidden');
            const googleLogo = targetButton.querySelector('img');
            if (googleLogo) googleLogo.style.display = 'none';
        } else {
            spinners.forEach(s => s.classList.remove('hidden'));
        }
    }
}
