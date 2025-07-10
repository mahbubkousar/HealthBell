import { auth, db } from "../firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- REGISTRATION LOGIC ---
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullname = registerForm.fullname.value;
    const email = registerForm.email.value;
    const password = registerForm.password.value;
    const role = registerForm.role.value;
    const errorMessage = document.getElementById("error-message");

    // Hide previous error messages on new submission
    errorMessage.classList.remove("visible");
    errorMessage.textContent = "";

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Create user profile document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: fullname,
        email: email,
        role: role,
      });

      console.log("User profile created successfully.");

      // 3. Redirect to login page
      window.location.href = "/login.html";
    } catch (error) {
      console.error("Error during registration:", error);
      // Translate common Firebase errors into friendlier messages
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage.textContent =
            "This email address is already in use by another account.";
          break;
        case "auth/weak-password":
          errorMessage.textContent =
            "Password should be at least 6 characters long.";
          break;
        default:
          errorMessage.textContent =
            "An error occurred during registration. Please try again.";
          break;
      }
      errorMessage.classList.add("visible"); // Make the error message visible
    }
  });
}

// --- LOGIN LOGIC ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = loginForm.email.value;
    const password = loginForm.password.value;
    const errorMessage = document.getElementById("error-message");

    // Hide previous error messages on new submission
    errorMessage.classList.remove("visible");
    errorMessage.textContent = "";

    try {
      // 1. Sign in the user with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Fetch the user's profile from Firestore to get their role
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;

        // 3. Redirect based on role
        if (role === "patient") {
          window.location.href = "/patient-dashboard.html";
        } else if (role === "doctor") {
          window.location.href = "/doctor-dashboard.html";
        } else if (role === "pharmacy") {
          window.location.href = "/pharmacy-dashboard.html";
        } else {
          // Fallback to the homepage if role is not defined
          window.location.href = "/index.html";
        }
      } else {
        // This case is unlikely but good for robustness
        throw new Error("User data not found. Please contact support.");
      }
    } catch (error) {
      console.error("Error during login:", error);
      // Translate common Firebase errors
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        errorMessage.textContent =
          "Invalid email or password. Please try again.";
      } else {
        errorMessage.textContent =
          "An error occurred during login. Please try again.";
      }
      errorMessage.classList.add("visible"); // Make the error message visible
    }
  });
}
