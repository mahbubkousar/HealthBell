import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, getDocs, addDoc, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DOM Element References ---
const patientSelect = document.getElementById('patient-select');
const medicinesContainer = document.getElementById('medicines-container');
const addMedicineBtn = document.getElementById('add-medicine-btn');
const prescriptionForm = document.getElementById('prescription-form');
const logoutButton = document.getElementById('logout-button');
const successMessage = document.getElementById('success-message');
const medicineTemplate = document.getElementById('medicine-template'); // Get the template

let doctorId;
let doctorName;

// --- AUTHENTICATION & REDIRECTION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uid = user.uid;
        doctorId = uid; 
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'doctor') {
            doctorName = userDoc.data().name; 
            loadPatients();
            addMedicineField(); // Add the first medicine field on page load
        } else {
            window.location.href = '/login.html';
        }
    } else {
        window.location.href = '/login.html';
    }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = '/login.html';
    });
});

// --- LOAD PATIENTS INTO DROPDOWN ---
async function loadPatients() {
    try {
        const q = query(collection(db, "users"), where("role", "==", "patient"));
        const querySnapshot = await getDocs(q);
        patientSelect.innerHTML = '<option value="">Select a patient</option>'; 
        querySnapshot.forEach((doc) => {
            const patient = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; 
            option.textContent = patient.name;
            option.dataset.name = patient.name;
            patientSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading patients: ", error);
    }
}

// --- DYNAMICALLY ADD MEDICINE FIELDS (REFACTORED) ---
let medicineCount = 0;
function addMedicineField() {
    medicineCount++;
    
    // 1. Clone the template content
    const templateContent = medicineTemplate.content.cloneNode(true);
    
    // 2. The template gives us a document-fragment. We find our main div inside it.
    const newMedicineDiv = templateContent.querySelector('.p-4');

    // 3. Create and prepend the dynamic heading
    const heading = document.createElement('h4');
    heading.className = 'font-semibold text-gray-700';
    heading.textContent = `Medicine ${medicineCount}`;
    newMedicineDiv.prepend(heading); // Add the title to the top of the new section
    
    // 4. Append the new, complete section to the container
    medicinesContainer.appendChild(newMedicineDiv);
}

addMedicineBtn.addEventListener('click', addMedicineField);

// --- FORM SUBMISSION LOGIC (No changes needed here) ---
prescriptionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedOption = patientSelect.options[patientSelect.selectedIndex];
    const patientId = selectedOption.value;
    const patientName = selectedOption.dataset.name;

    const medicines = [];
    // The query selector '.p-4.border' is still valid as our template creates this structure
    const medicineDivs = medicinesContainer.querySelectorAll('.p-4.border');
    
    let formIsValid = true;
    medicineDivs.forEach(div => {
        const medicineName = div.querySelector('input[name="medicineName"]').value;
        const totalDays = parseInt(div.querySelector('input[name="totalDays"]').value, 10);
        const morning = div.querySelector('input[name="doseMorning"]').checked;
        const noon = div.querySelector('input[name="doseNoon"]').checked;
        const night = div.querySelector('input[name="doseNight"]').checked;
        
        if (!morning && !noon && !night) {
             alert(`Please select at least one dose (Morning, Noon, or Night) for ${medicineName}.`);
             formIsValid = false;
        }

        if (medicineName && totalDays > 0) {
            medicines.push({
                name: medicineName, totalDays: totalDays,
                dose: { morning: morning ? 1 : 0, noon: noon ? 1 : 0, night: night ? 1 : 0 },
                stockCount: 0, remainingCount: 0
            });
        }
    });

    if (!formIsValid) return;

    if (!patientId || medicines.length === 0) {
        alert("Please select a patient and fill out all medicine details.");
        return;
    }

    try {
        await addDoc(collection(db, "prescriptions"), {
            patientId, patientName, doctorId, doctorName,
            startDate: new Date().toISOString().split('T')[0],
            status: "active",
            medicines: medicines
        });
        successMessage.textContent = "Prescription saved successfully!";
        prescriptionForm.reset();
        medicinesContainer.innerHTML = "";
        medicineCount = 0; // Reset counter
        addMedicineField();
        setTimeout(() => { successMessage.textContent = ""; }, 3000);

    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Failed to save prescription. Please try again.");
    }
});