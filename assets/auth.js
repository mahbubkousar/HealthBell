// Import functions from other scripts
import { auth, db } from '../firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- REGISTRATION LOGIC ---
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent form from submitting the default way

        // Get user inputs
        const fullname = registerForm.fullname.value;
        const email = registerForm.email.value;
        const password = registerForm.password.value;
        const role = registerForm.role.value;
        const errorMessage = document.getElementById('error-message');

        try {
            // 1. Create user in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            console.log('User created in Auth:', user);

            // 2. Create user profile document in Firestore
            // We use the user's UID from Auth as the document ID in Firestore
            await setDoc(doc(db, "users", user.uid), {
                name: fullname,
                email: email,
                role: role
            });

            console.log('User profile created in Firestore');
            
            // 3. Redirect to login page after successful registration
            window.location.href = '/login.html';

        } catch (error) {
            console.error("Error during registration:", error);
            errorMessage.textContent = error.message;
        }
    });
}


// --- LOGIN LOGIC ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get user inputs
        const email = loginForm.email.value;
        const password = loginForm.password.value;
        const errorMessage = document.getElementById('error-message');
        
        try {
            // 1. Sign in the user with Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log('User logged in:', user);

            // 2. Fetch the user's profile from Firestore to get their role
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const role = userData.role;

                // 3. Redirect based on role
                console.log('User role:', role);
                if (role === 'patient') {
                    window.location.href = '/patient-dashboard.html';
                } else if (role === 'doctor') {
                    window.location.href = '/doctor-dashboard.html';
                } else if (role === 'pharmacy') {
                    window.location.href = '/pharmacy-dashboard.html';
                } else {
                    // Fallback in case role is not set
                    window.location.href = '/index.html';
                }
            } else {
                throw new Error("User data not found in Firestore.");
            }

        } catch (error) {
            console.error("Error during login:", error);
            errorMessage.textContent = error.message;
        }
    });
}