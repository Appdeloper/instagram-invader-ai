/**
 * Firebase Configuration for Instagram Invader AI
 * Paste your real Firebase configurations below.
 */

// Load Firebase config from settings or fallback to placeholder
const savedConfig = localStorage.getItem('invader_firebase_config');
if (savedConfig) {
    try {
        window.firebaseConfig = JSON.parse(savedConfig);
    } catch (e) {
        console.error("Invalid Firebase Config JSON in localStorage:", e);
        window.firebaseConfig = {};
    }
} else {
    window.firebaseConfig = {
        apiKey: "YOUR_API_KEY_HERE",
        authDomain: "YOUR_AUTH_DOMAIN_HERE",
        projectId: "YOUR_PROJECT_ID_HERE",
        storageBucket: "YOUR_STORAGE_BUCKET_HERE",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
        appId: "YOUR_APP_ID_HERE"
    };
}

// Dynamic auth mode configuration (Mock vs Firebase) from Settings
const savedAuthMode = localStorage.getItem('invader_auth_mode');
if (savedAuthMode) {
    window.USE_MOCK_AUTH = (savedAuthMode === 'mock');
} else {
    // Default to true (mock) for local testing without keys, or if on GitHub Pages
    window.USE_MOCK_AUTH = true;
}
