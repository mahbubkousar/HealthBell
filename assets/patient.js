import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const prescriptionsList = document.getElementById('prescriptions-list');
const logoutButton = document.getElementById('logout-button');
const welcomeName = document.getElementById('welcome-name');

// --- AUTHENTICATION & DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uid = user.uid;
        
        // Check user role
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'patient') {
            welcomeName.textContent = `Welcome, ${userDoc.data().name}!`;
            loadPrescriptions(uid);
        } else {
            // Not a patient, redirect
            window.location.href = '/login.html';
        }
    } else {
        // User not logged in
        window.location.href = '/login.html';
    }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = '/login.html';
    }).catch((error) => {
        console.error("Sign out error", error);
    });
});


// --- LOAD & DISPLAY PRESCRIPTIONS ---
async function loadPrescriptions(patientId) {
    prescriptionsList.innerHTML = '<p>Loading your prescriptions...</p>';

    try {
        const q = query(collection(db, "prescriptions"), where("patientId", "==", patientId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            prescriptionsList.innerHTML = '<p>You have no active prescriptions.</p>';
            return;
        }

        prescriptionsList.innerHTML = ''; // Clear loading message
        querySnapshot.forEach(doc => {
            const prescription = doc.data();
            const prescriptionCard = createPrescriptionCard(prescription);
            prescriptionsList.appendChild(prescriptionCard);
        });

    } catch (error) {
        console.error("Error loading prescriptions: ", error);
        prescriptionsList.innerHTML = '<p>Could not load prescriptions. Please try again later.</p>';
    }
}

function createPrescriptionCard(prescription) {
    const card = document.createElement('div');
    card.className = 'bg-white p-6 rounded-lg shadow-md';

    let medicinesHtml = '<ul class="list-disc list-inside mt-2 space-y-1">';
    prescription.medicines.forEach(med => {
        const doses = [];
        if (med.dose.morning) doses.push('Morning');
        if (med.dose.noon) doses.push('Noon');
        if (med.dose.night) doses.push('Night');
        medicinesHtml += `<li><strong>${med.name}</strong> - Doses: ${doses.join(', ')}</li>`;
    });
    medicinesHtml += '</ul>';

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h3 class="text-xl font-bold text-gray-800">Prescription from Dr. ${prescription.doctorName}</h3>
                <p class="text-sm text-gray-500">Date: ${prescription.startDate} | Duration: ${prescription.totalDays} days</p>
            </div>
            <span class="text-sm font-semibold py-1 px-3 rounded-full ${prescription.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'}">
                ${prescription.status}
            </span>
        </div>
        <div class="mt-4">
            <h4 class="font-semibold text-gray-700">Medicines:</h4>
            ${medicinesHtml}
        </div>
    `;
    return card;
}