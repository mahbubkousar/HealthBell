// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
// PASTE YOUR FIREBASE CONFIG OBJECT HERE
const firebaseConfig = {
  apiKey: "AIzaSyAogYrFUa9lvmarI3Mv02OWIrUaHuTflYA",
  authDomain: "healthbell-74b9f.firebaseapp.com",
  projectId: "healthbell-74b9f",
  storageBucket: "healthbell-74b9f.firebasestorage.app",
  messagingSenderId: "601048053152",
  appId: "1:601048053152:web:cf752e14f63df168c620c5",
  measurementId: "G-RWJQD6VTQV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use in other scripts
export { auth, db };