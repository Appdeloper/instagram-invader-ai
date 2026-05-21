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
            
            // Listen to real auth state changes
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    onLoginSuccess({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email.split('@')[0],
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
            handleEmailLogin();
        });
    }

    if (signupFormEl) {
        signupFormEl.addEventListener('submit', (e) => {
            e.preventDefault();
            handleEmailSignup();
        });
    }

    // D. Google Sign-in Buttons
    const googleButtons = document.querySelectorAll('.google-signin-btn');
    googleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            handleGoogleSignIn();
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
function handleEmailLogin() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showAuthAlert('login-alert', 'Please enter your email and password.', 'error');
        return;
    }

    setAuthLoading(true);

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
function handleEmailSignup() {
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

    if (password.length < 6) {
        showAuthAlert('signup-alert', 'Password must be at least 6 characters.', 'error');
        return;
    }

    setAuthLoading(true);

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
function handleGoogleSignIn() {
    setAuthLoading(true);

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
function setAuthLoading(isLoading) {
    const spinners = document.querySelectorAll('.auth-card-spinner');
    spinners.forEach(s => {
        if (isLoading) s.classList.remove('hidden');
        else s.classList.add('hidden');
    });
}
