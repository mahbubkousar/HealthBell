import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, getDocs, addDoc, query, where, doc, getDoc, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
const appointmentRequestsContainer = document.getElementById('appointment-requests-container'); // NEW

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
            // Load all necessary data on login
            loadPatients();
            loadAppointmentRequests(); // NEW
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

// --- APPOINTMENT MANAGEMENT LOGIC (NEW) ---
async function loadAppointmentRequests() {
    appointmentRequestsContainer.innerHTML = '<p class="text-center text-gray-500">Loading requests...</p>';
    
    try {
        const q = query(
            collection(db, "appointments"),
            where("doctorId", "==", doctorId),
            where("status", "==", "pending"),
            orderBy("createdAt", "asc")
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            appointmentRequestsContainer.innerHTML = '<p class="text-center text-gray-500">No pending appointment requests.</p>';
            return;
        }

        appointmentRequestsContainer.innerHTML = '';
        querySnapshot.forEach(doc => {
            const request = doc.data();
            const requestCard = document.createElement('div');
            requestCard.className = 'p-4 border rounded-lg bg-gray-50';
            requestCard.innerHTML = `
                <p class="font-semibold text-gray-800">${request.patientName}</p>
                <p class="text-sm text-gray-600">${new Date(request.slotDateTime).toLocaleString()}</p>
                <div class="mt-3 flex gap-2">
                    <button class="approve-btn bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-1 px-3 rounded" data-id="${doc.id}">Approve</button>
                    <button class="reject-btn bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded" data-id="${doc.id}">Reject</button>
                </div>
            `;
            appointmentRequestsContainer.appendChild(requestCard);
        });

    } catch (error) {
        console.error("Error loading appointment requests: ", error);
        appointmentRequestsContainer.innerHTML = '<p class="text-center text-red-500">Could not load requests. An index may be required.</p>';
        // Console will provide a link to create the index if needed.
    }
}

appointmentRequestsContainer.addEventListener('click', async (e) => {
    const button = e.target;
    const appointmentId = button.dataset.id;
    if (!appointmentId) return;

    let newStatus = '';
    if (button.classList.contains('approve-btn')) {
        newStatus = 'confirmed';
    } else if (button.classList.contains('reject-btn')) {
        newStatus = 'rejected';
    }

    if (newStatus) {
        try {
            const appointmentRef = doc(db, "appointments", appointmentId);
            await updateDoc(appointmentRef, { status: newStatus });
            
            // Visually remove the card from the list
            button.closest('.p-4').innerHTML = `<p class="text-center font-semibold ${newStatus === 'confirmed' ? 'text-green-600' : 'text-red-600'}">Request ${newStatus}.</p>`;
            
        } catch (error) {
            console.error("Error updating appointment status: ", error);
            alert('Failed to update status. Please try again.');
        }
    }
});


// --- LOAD PATIENTS (No changes) ---
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

// --- ADHERENCE REPORT LOGIC (No changes) ---
patientAdherenceSelect.addEventListener('change', (e) => {
    const patientId = e.target.value;
    const patientName = e.target.options[e.target.selectedIndex].text;
    if (patientId) { loadAdherenceReport(patientId, patientName); } 
    else { adherenceReportContainer.innerHTML = '<p class="text-center text-gray-500">Please select a patient.</p>'; }
});

async function loadAdherenceReport(patientId, patientName) {
    adherenceReportContainer.innerHTML = `<p class="text-center text-gray-500">Calculating report for ${patientName}...</p>`;
    // ... (rest of the adherence report logic is unchanged)
    try{const e=query(collection(db,"medicationLog"),where("patientId","==",patientId)),t=query(collection(db,"prescriptions"),where("patientId","==",patientId),where("status","==","active"));const[o,n]=await Promise.all([getDocs(e),getDocs(t)]);if(n.empty)return void(adherenceReportContainer.innerHTML='<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Active Prescriptions</h4><p class="text-blue-700">'+patientName+" has no active prescriptions to track.</p></div>");const a=new Set;o.forEach(e=>{const t=e.data();a.add(t.dateTaken+"_"+t.medicineName+"_"+t.doseTime)});const i={},s=new Date;s.setHours(0,0,0,0),n.forEach(e=>{const t=e.data(),o=new Date(t.startDate+"T00:00:00");t.medicines.forEach(e=>{const t=new Date(o);t.setDate(o.getDate()+e.totalDays);for(let r=new Date(o);r<s&&r<t;r.setDate(r.getDate()+1)){const t=r.toISOString().split("T")[0];i[t]||(i[t]={taken:[],missed:[]}),["morning","noon","night"].forEach(o=>{if(e.dose[o]>0){const r={name:e.name,doseTime:o};a.has(t+"_"+e.name+"_"+o)?i[t].taken.push(r):i[t].missed.push(r)}})}})}),renderCombinedReport(i,patientName)}catch(e){console.error("Error loading adherence report: ",e),adherenceReportContainer.innerHTML='<p class="text-center text-red-500">Could not load report. A Firestore index may be required.</p>'}
}

function renderCombinedReport(reportData, patientName) {
    // ... (rest of the adherence report rendering logic is unchanged)
    let e='<h3 class="text-xl font-bold text-gray-800 mb-4">Adherence Log for: '+patientName+"</h3>";const t=Object.keys(reportData).sort((e,t)=>new Date(t)-new Date(e));if(0===t.length)return void(adherenceReportContainer.innerHTML='<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Past Data</h4><p class="text-blue-700">No medication was scheduled on past days for '+patientName+".</p></div>");const o=e=>{const t=new Date(e+"T00:00:00"),o=new Date,n=new Date;return n.setDate(n.getDate()-1),t.toDateString()===o.toDateString()?"Today":t.toDateString()===n.toDateString()?"Yesterday":t.toLocaleDateString(void 0,{weekday:"long",month:"long",day:"numeric"})};t.forEach(t=>{const n=reportData[t];e+='<div class="mb-4"><h4 class="text-md font-bold text-gray-700 bg-gray-100 p-2 rounded-t-md flex justify-between items-center"><span>'+o(t)+'</span>'+(0===n.missed.length?'<span class="text-sm font-semibold text-green-600">Perfect Day!</span>':"")+'</h4><div class="border rounded-b-md divide-y divide-gray-200">',n.taken.forEach(t=>{e+='<div class="p-3 flex items-center"><span class="text-green-500 mr-3">✅</span><div><span class="font-semibold text-gray-800">'+t.name+'</span><span class="text-sm ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full">'+t.doseTime+"</span></div></div>"}),n.missed.forEach(t=>{e+='<div class="p-3 flex items-center bg-red-50"><span class="text-red-500 mr-3">❌</span><div><span class="font-semibold text-gray-800">'+t.name+'</span><span class="text-sm ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full">'+t.doseTime+"</span></div></div>"}),e+="</div></div>"}),adherenceReportContainer.innerHTML=e
}

// --- PRESCRIPTION CREATION LOGIC (No changes) ---
function addMedicineField() { medicineCount++; const t = medicineTemplate.content.cloneNode(true), e = t.querySelector(".p-4"), o = document.createElement("h4"); o.className = "font-semibold text-gray-700", o.textContent = `Medicine ${medicineCount}`, e.prepend(o), medicinesContainer.appendChild(e) } addMedicineBtn.addEventListener("click", addMedicineField);
prescriptionForm.addEventListener("submit", async t => { t.preventDefault(); const e = patientSelect.options[patientSelect.selectedIndex], o = e.value, n = e.dataset.name, a = [], i = medicinesContainer.querySelectorAll(".p-4.border"); let d = !0; i.forEach(t => { const e = t.querySelector('input[name="medicineName"]').value, o = parseInt(t.querySelector('input[name="totalDays"]').value, 10), n = t.querySelector('input[name="doseMorning"]').checked, i = t.querySelector('input[name="doseNoon"]').checked, s = t.querySelector('input[name="doseNight"]').checked; n || i || s ? e && o > 0 && a.push({ name: e, totalDays: o, dose: { morning: n ? 1 : 0, noon: i ? 1 : 0, night: s ? 1 : 0 }, stockCount: 0, remainingCount: 0 }) : (alert(`Please select at least one dose (Morning, Noon, or Night) for ${e}.`), d = !1) }), d && (o && 0 !== a.length ? (await addDoc(collection(db, "prescriptions"), { patientId: o, patientName: n, doctorId: doctorId, doctorName: doctorName, startDate: (new Date).toISOString().split("T")[0], status: "active", medicines: a }), successMessage.textContent = "Prescription saved successfully!", prescriptionForm.reset(), medicinesContainer.innerHTML = "", medicineCount = 0, addMedicineField(), setTimeout(() => { successMessage.textContent = "" }, 3e3)) : alert("Please select a patient and fill out all medicine details.")) });