import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, getDocs, addDoc, query, where, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DOM Element References ---
const logoutButton = document.getElementById('logout-button');
const prescriptionForm = document.getElementById('prescription-form');
const patientSelect = document.getElementById('patient-select');
const medicinesContainer = document.getElementById('medicines-container');
const addMedicineBtn = document.getElementById('add-medicine-btn');
const medicineTemplate = document.getElementById('medicine-template');
const successMessage = document.getElementById('success-message');
const patientAdherenceSelect = document.getElementById('patient-adherence-select');
const adherenceReportContainer = document.getElementById('adherence-report-container');

let doctorId, doctorName;
let medicineCount = 0;

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'doctor') {
            doctorId = user.uid;
            doctorName = userDoc.data().name;
            loadPatients();
            addMedicineField();
        } else {
            window.location.href = '/login.html';
        }
    } else {
        window.location.href = '/login.html';
    }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = '/login.html');
});

// --- LOAD PATIENTS INTO DROPDOWNS ---
async function loadPatients() {
    try {
        const q = query(collection(db, "users"), where("role", "==", "patient"));
        const querySnapshot = await getDocs(q);
        const patientDefaultOption = '<option value="">Select a patient</option>';
        patientSelect.innerHTML = patientDefaultOption;
        patientAdherenceSelect.innerHTML = patientDefaultOption;
        querySnapshot.forEach((doc) => {
            const patient = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = patient.name;
            option.dataset.name = patient.name;
            patientSelect.appendChild(option.cloneNode(true));
            patientAdherenceSelect.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error("Error loading patients: ", error);
    }
}

// --- ADHERENCE REPORT LOGIC (HEAVILY REVISED) ---
patientAdherenceSelect.addEventListener('change', (e) => {
    const patientId = e.target.value;
    const patientName = e.target.options[e.target.selectedIndex].text;
    if (patientId) {
        loadAdherenceReport(patientId, patientName);
    } else {
        adherenceReportContainer.innerHTML = '<p class="text-center text-gray-500">Please select a patient to see their adherence history.</p>';
    }
});

async function loadAdherenceReport(patientId, patientName) {
    adherenceReportContainer.innerHTML = `<p class="text-center text-gray-500">Calculating adherence report for ${patientName}...</p>`;
    
    try {
        // 1. Fetch all necessary data in parallel
        const logQuery = query(collection(db, "medicationLog"), where("patientId", "==", patientId));
        const presQuery = query(collection(db, "prescriptions"), where("patientId", "==", patientId), where("status", "==", "active"));
        
        const [logSnapshot, presSnapshot] = await Promise.all([getDocs(logQuery), getDocs(presQuery)]);

        if (presSnapshot.empty) {
            adherenceReportContainer.innerHTML = `<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Active Prescriptions</h4><p class="text-blue-700">${patientName} has no active prescriptions to track.</p></div>`;
            return;
        }

        // 2. Process logs into an efficient lookup Set
        const takenDoses = new Set();
        logSnapshot.forEach(doc => {
            const log = doc.data();
            takenDoses.add(`${log.dateTaken}_${log.medicineName}_${log.doseTime}`);
        });

        // 3. Calculate expected vs. actual doses
        const reportData = {}; // { "YYYY-MM-DD": { taken: [], missed: [] } }
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to midnight

        presSnapshot.forEach(doc => {
            const prescription = doc.data();
            const startDate = new Date(prescription.startDate + 'T00:00:00');
            
            prescription.medicines.forEach(med => {
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + med.totalDays);

                // Iterate from start date up to yesterday
                for (let d = new Date(startDate); d < today && d < endDate; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split('T')[0];
                    if (!reportData[dateStr]) {
                        reportData[dateStr] = { taken: [], missed: [] };
                    }
                    
                    ['morning', 'noon', 'night'].forEach(doseTime => {
                        if (med.dose[doseTime] > 0) {
                            const doseKey = `${dateStr}_${med.name}_${doseTime}`;
                            const doseEntry = { name: med.name, doseTime: doseTime };
                            if (takenDoses.has(doseKey)) {
                                reportData[dateStr].taken.push(doseEntry);
                            } else {
                                reportData[dateStr].missed.push(doseEntry);
                            }
                        }
                    });
                }
            });
        });

        // 4. Render the combined report
        renderCombinedReport(reportData, patientName);

    } catch (error) {
        console.error("Error loading adherence report: ", error);
        adherenceReportContainer.innerHTML = '<p class="text-center text-red-500">Could not load report. A Firestore index may be required.</p>';
    }
}

function renderCombinedReport(reportData, patientName) {
    let reportHtml = `<h3 class="text-xl font-bold text-gray-800 mb-4">Adherence Log for: ${patientName}</h3>`;

    const sortedDates = Object.keys(reportData).sort((a, b) => new Date(b) - new Date(a));

    if (sortedDates.length === 0) {
        adherenceReportContainer.innerHTML = `<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Past Data</h4><p class="text-blue-700">No medication was scheduled on past days for ${patientName}.</p></div>`;
        return;
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString + 'T00:00:00');
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    };

    sortedDates.forEach(date => {
        const dayData = reportData[date];
        reportHtml += `<div class="mb-4">
            <h4 class="text-md font-bold text-gray-700 bg-gray-100 p-2 rounded-t-md flex justify-between items-center">
                <span>${formatDate(date)}</span>
                ${dayData.missed.length === 0 ? '<span class="text-sm font-semibold text-green-600">Perfect Day!</span>' : ''}
            </h4>
            <div class="border rounded-b-md divide-y divide-gray-200">`;

        // Render taken doses
        dayData.taken.forEach(log => {
            reportHtml += `<div class="p-3 flex items-center"><span class="text-green-500 mr-3">✅</span>
                <div><span class="font-semibold text-gray-800">${log.name}</span>
                <span class="text-sm ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full">${log.doseTime}</span></div></div>`;
        });
        // Render missed doses
        dayData.missed.forEach(log => {
            reportHtml += `<div class="p-3 flex items-center bg-red-50"><span class="text-red-500 mr-3">❌</span>
                <div><span class="font-semibold text-gray-800">${log.name}</span>
                <span class="text-sm ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full">${log.doseTime}</span></div></div>`;
        });

        reportHtml += `</div></div>`;
    });

    adherenceReportContainer.innerHTML = reportHtml;
}


// --- PRESCRIPTION CREATION LOGIC (No changes below this line) ---
function addMedicineField() { medicineCount++; const t = medicineTemplate.content.cloneNode(true), e = t.querySelector(".p-4"), o = document.createElement("h4"); o.className = "font-semibold text-gray-700", o.textContent = `Medicine ${medicineCount}`, e.prepend(o), medicinesContainer.appendChild(e) } addMedicineBtn.addEventListener("click", addMedicineField);
prescriptionForm.addEventListener("submit", async t => { t.preventDefault(); const e = patientSelect.options[patientSelect.selectedIndex], o = e.value, n = e.dataset.name, a = [], i = medicinesContainer.querySelectorAll(".p-4.border"); let d = !0; i.forEach(t => { const e = t.querySelector('input[name="medicineName"]').value, o = parseInt(t.querySelector('input[name="totalDays"]').value, 10), n = t.querySelector('input[name="doseMorning"]').checked, i = t.querySelector('input[name="doseNoon"]').checked, s = t.querySelector('input[name="doseNight"]').checked; n || i || s ? e && o > 0 && a.push({ name: e, totalDays: o, dose: { morning: n ? 1 : 0, noon: i ? 1 : 0, night: s ? 1 : 0 }, stockCount: 0, remainingCount: 0 }) : (alert(`Please select at least one dose (Morning, Noon, or Night) for ${e}.`), d = !1) }), d && (o && 0 !== a.length ? await async function(t, e, o, n, a, i) { try { await addDoc(collection(db, "prescriptions"), { patientId: t, patientName: e, doctorId: o, doctorName: n, startDate: (new Date).toISOString().split("T")[0], status: "active", medicines: a }), successMessage.textContent = "Prescription saved successfully!", prescriptionForm.reset(), medicinesContainer.innerHTML = "", medicineCount = 0, addMedicineField(), setTimeout(() => { successMessage.textContent = "" }, 3e3) } catch (t) { console.error("Error adding document: ", t), alert("Failed to save prescription. Please try again.") } }(o, n, doctorId, doctorName, a) : alert("Please select a patient and fill out all medicine details.")) });
