/**
 * Firebase Configuration for Instagram Invader AI
 * Paste your real Firebase configurations below.
 */

window.firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTH_DOMAIN_HERE",
    projectId: "YOUR_PROJECT_ID_HERE",
    storageBucket: "YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "YOUR_APP_ID_HERE"
};

// Dynamic auth mode configuration (Mock vs Firebase) from Settings
const savedAuthMode = localStorage.getItem('invader_auth_mode');
if (savedAuthMode) {
    window.USE_MOCK_AUTH = (savedAuthMode === 'mock');
} else {
    // Default to true (mock) for local testing without keys, or if on GitHub Pages
    window.USE_MOCK_AUTH = true;
}
