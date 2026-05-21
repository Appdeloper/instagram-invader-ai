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
        apiKey: "AIzaSyCx9sKa830lGGPHT2Q35xQHcx7sK1qGkuc",
        authDomain: "instagram-invader.firebaseapp.com",
        projectId: "instagram-invader",
        storageBucket: "instagram-invader.firebasestorage.app",
        messagingSenderId: "178509157323",
        appId: "1:178509157323:web:94169cd4431e1b4bd35c4e",
        measurementId: "G-KN9C5616NR"
    };
}

// Dynamic auth mode configuration (Mock vs Firebase) from Settings
const savedAuthMode = localStorage.getItem('invader_auth_mode');
if (savedAuthMode) {
    window.USE_MOCK_AUTH = (savedAuthMode === 'mock');
} else {
    // Default to false (Firebase) now that real config is provided
    window.USE_MOCK_AUTH = false;
}
