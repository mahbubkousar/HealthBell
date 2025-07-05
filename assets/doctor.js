import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, getDocs, addDoc, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const patientSelect = document.getElementById('patient-select');
const medicinesContainer = document.getElementById('medicines-container');
const addMedicineBtn = document.getElementById('add-medicine-btn');
const prescriptionForm = document.getElementById('prescription-form');
const logoutButton = document.getElementById('logout-button');
const successMessage = document.getElementById('success-message');

let doctorId;
let doctorName;

// --- AUTHENTICATION & REDIRECTION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in.
        const uid = user.uid;
        doctorId = uid; // Store doctor's UID

        // Check user role
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'doctor') {
            doctorName = userDoc.data().name; // Store doctor's name
            // User is a doctor, so load the necessary data.
            loadPatients();
            addMedicineField(); // Add the first medicine field by default
        } else {
            // If not a doctor, redirect to login.
            console.log("Access denied. User is not a doctor.");
            window.location.href = '/login.html';
        }
    } else {
        // User is signed out. Redirect to login.
        console.log("User is not signed in.");
        window.location.href = '/login.html';
    }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log("User signed out successfully");
        window.location.href = '/login.html';
    }).catch((error) => {
        console.error("Sign out error", error);
    });
});

// --- LOAD PATIENTS INTO DROPDOWN ---
async function loadPatients() {
    try {
        const q = query(collection(db, "users"), where("role", "==", "patient"));
        const querySnapshot = await getDocs(q);
        
        patientSelect.innerHTML = '<option value="">Select a patient</option>'; // Clear previous options
        querySnapshot.forEach((doc) => {
            const patient = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; // The value is the patient's UID
            option.textContent = patient.name;
            option.dataset.name = patient.name; // Store patient name
            patientSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading patients: ", error);
        patientSelect.innerHTML = '<option value="">Could not load patients</option>';
    }
}

// --- DYNAMICALLY ADD MEDICINE FIELDS ---
let medicineCount = 0;
function addMedicineField() {
    medicineCount++;
    const medicineDiv = document.createElement('div');
    medicineDiv.className = 'p-4 border rounded-md space-y-2';
    medicineDiv.innerHTML = `
        <h4 class="font-semibold">Medicine ${medicineCount}</h4>
        <div>
            <label class="block text-sm font-medium text-gray-700">Medicine Name</label>
            <input type="text" name="medicineName" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" required>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Daily Dose</label>
            <div class="flex items-center space-x-4 mt-1">
                <label><input type="checkbox" name="doseMorning" class="form-checkbox"> Morning</label>
                <label><input type="checkbox" name="doseNoon" class="form-checkbox"> Noon</label>
                <label><input type="checkbox" name="doseNight" class="form-checkbox"> Night</label>
            </div>
        </div>
    `;
    medicinesContainer.appendChild(medicineDiv);
}

addMedicineBtn.addEventListener('click', addMedicineField);

// --- FORM SUBMISSION LOGIC ---
prescriptionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get selected patient info
    const selectedOption = patientSelect.options[patientSelect.selectedIndex];
    const patientId = selectedOption.value;
    const patientName = selectedOption.dataset.name;
    const totalDays = parseInt(prescriptionForm.querySelector('#total-days').value, 10);

    // Collect medicine data
    const medicines = [];
    const medicineDivs = medicinesContainer.querySelectorAll('.p-4');
    medicineDivs.forEach(div => {
        const medicineName = div.querySelector('input[name="medicineName"]').value;
        const morning = div.querySelector('input[name="doseMorning"]').checked;
        const noon = div.querySelector('input[name="doseNoon"]').checked;
        const night = div.querySelector('input[name="doseNight"]').checked;
        
        medicines.push({
            name: medicineName,
            dose: { morning: morning ? 1 : 0, noon: noon ? 1 : 0, night: night ? 1 : 0 },
            // These will be used later
            stockCount: 0,
            remainingCount: 0
        });
    });

    if (!patientId || medicines.length === 0) {
        alert("Please select a patient and add at least one medicine.");
        return;
    }

    try {
        // Create a new document in the 'prescriptions' collection
        await addDoc(collection(db, "prescriptions"), {
            patientId: patientId,
            patientName: patientName,
            doctorId: doctorId,
            doctorName: doctorName,
            startDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
            totalDays: totalDays,
            status: "active",
            medicines: medicines
        });

        successMessage.textContent = "Prescription saved successfully!";
        prescriptionForm.reset();
        medicinesContainer.innerHTML = ""; // Clear medicine fields
        addMedicineField(); // Add one back for the next entry
        
        // Hide success message after 3 seconds
        setTimeout(() => { successMessage.textContent = ""; }, 3000);

    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Failed to save prescription. Please try again.");
    }
});