// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
// PASTE YOUR FIREBASE CONFIG OBJECT HERE
const firebaseConfig = {
	apiKey: "AIzaSyCPco6NYzNQ0wLTHCKh2i9R_YxDtwQNm3M",
	authDomain: "healthbell2-f72f7.firebaseapp.com",
	projectId: "healthbell2-f72f7",
	storageBucket: "healthbell2-f72f7.firebasestorage.app",
	messagingSenderId: "367462999886",
	appId: "1:367462999886:web:bb8381fc2a58b1971a201f",
	measurementId: "G-QW48EMZCQV",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use in other scripts
export { auth, db };
