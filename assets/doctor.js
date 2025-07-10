import { auth, db } from "../firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DOM Element References ---
const loadingOverlay = document.getElementById("loading-overlay");
const logoutButton = document.getElementById("logout-button");
const prescriptionForm = document.getElementById("prescription-form");
const patientSelect = document.getElementById("patient-select");
const medicinesContainer = document.getElementById("medicines-container");
const addMedicineBtn = document.getElementById("add-medicine-btn");
const medicineTemplate = document.getElementById("medicine-template");
const successMessage = document.getElementById("success-message");
const patientAdherenceSelect = document.getElementById(
  "patient-adherence-select"
);
const adherenceReportContainer = document.getElementById(
  "adherence-report-container"
);
const appointmentRequestsContainer = document.getElementById(
  "appointment-requests-container"
);
const upcomingAppointmentsContainer = document.getElementById(
  "upcoming-appointments-container"
);

let doctorId, doctorName;
let medicineCount = 0;

// --- AUTHENTICATION & MASTER DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().role === "doctor") {
      doctorId = user.uid;
      doctorName = userDoc.data().name;
      await loadAllDoctorData();
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

async function loadAllDoctorData() {
  loadingOverlay.style.display = "flex";
  try {
    await Promise.all([
      loadPatients(),
      loadAppointmentRequests(),
      loadUpcomingAppointments(),
    ]);
    addMedicineField();
  } catch (error) {
    console.error("Error loading doctor dashboard data:", error);
  } finally {
    loadingOverlay.style.display = "none";
  }
}

// --- LOGOUT ---
logoutButton.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "/login.html"));
});

// --- APPOINTMENT MANAGEMENT ---
async function loadAppointmentRequests() {
  try {
    const q = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId),
      where("status", "==", "pending"),
      orderBy("createdAt", "asc")
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      appointmentRequestsContainer.innerHTML =
        '<p class="loading-placeholder">No pending requests.</p>';
      return;
    }
    appointmentRequestsContainer.innerHTML = querySnapshot.docs
      .map((doc) => {
        const request = doc.data();
        return `<div class="p-4 border rounded-lg bg-gray-50 flex justify-between items-center"><div class="flex-1"><p class="font-semibold text-gray-800">${
          request.patientName
        }</p><p class="text-sm text-gray-600">${new Date(
          request.slotDateTime
        ).toLocaleString()}</p></div><div class="flex gap-2"><button class="approve-btn btn bg-green-500 text-white text-xs py-1 px-3" data-id="${
          doc.id
        }">Approve</button><button class="reject-btn btn bg-red-500 text-white text-xs py-1 px-3" data-id="${
          doc.id
        }">Reject</button></div></div>`;
      })
      .join("");
  } catch (error) {
    console.error("Error loading appointment requests: ", error);
    appointmentRequestsContainer.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load requests.</p>';
  }
}

appointmentRequestsContainer.addEventListener("click", async (e) => {
  const button = e.target.closest(".approve-btn, .reject-btn");
  if (!button) return;
  button.disabled = true;
  const appointmentId = button.dataset.id;
  const newStatus = button.classList.contains("approve-btn")
    ? "confirmed"
    : "rejected";
  try {
    await updateDoc(doc(db, "appointments", appointmentId), {
      status: newStatus,
    });
    // Instead of removing, we can just reload the lists for consistency
    await Promise.all([loadAppointmentRequests(), loadUpcomingAppointments()]);
  } catch (error) {
    console.error("Error updating appointment status: ", error);
    button.disabled = false;
  }
});

// --- UPCOMING APPOINTMENTS ---
async function loadUpcomingAppointments() {
  try {
    const today = new Date();
    const inOneWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId),
      where("status", "==", "confirmed"),
      where("slotDateTime", ">=", today.toISOString()),
      where("slotDateTime", "<=", inOneWeek.toISOString()),
      orderBy("slotDateTime", "asc")
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      upcomingAppointmentsContainer.innerHTML =
        '<p class="loading-placeholder">No upcoming appointments in the next 7 days.</p>';
      return;
    }
    upcomingAppointmentsContainer.innerHTML = querySnapshot.docs
      .map((doc) => {
        const appointment = doc.data();
        return `<div class="p-3 border-l-4 border-purple-500 bg-purple-50 rounded-r-lg"><p class="font-semibold text-gray-800">${
          appointment.patientName
        }</p><p class="text-sm text-gray-600">${new Date(
          appointment.slotDateTime
        ).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        })}</p></div>`;
      })
      .join("");
  } catch (error) {
    console.error("Error loading upcoming appointments: ", error);
    upcomingAppointmentsContainer.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load agenda. A Firestore index is likely required. Check the console.</p>';
  }
}

// --- LOAD PATIENTS ---
async function loadPatients() {
  const q = query(collection(db, "users"), where("role", "==", "patient"));
  const querySnapshot = await getDocs(q);
  const patientDefaultOption =
    '<option value="">-- Select a Patient --</option>';
  patientSelect.innerHTML = patientDefaultOption;
  patientAdherenceSelect.innerHTML = patientDefaultOption;
  querySnapshot.forEach((doc) => {
    const patient = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = patient.name;
    option.dataset.name = patient.name;
    patientSelect.appendChild(option.cloneNode(true));
    patientAdherenceSelect.appendChild(option.cloneNode(true));
  });
}

// --- ADHERENCE REPORT LOGIC ---
patientAdherenceSelect.addEventListener("change", (e) => {
  const patientId = e.target.value;
  const patientName = e.target.options[e.target.selectedIndex].text;
  if (patientId) {
    loadAdherenceReport(patientId, patientName);
  } else {
    adherenceReportContainer.innerHTML =
      '<p class="loading-placeholder">Please select a patient to see their adherence history.</p>';
  }
});

async function loadAdherenceReport(patientId, patientName) {
  adherenceReportContainer.innerHTML = `<p class="loading-placeholder">Calculating adherence report for ${patientName}...</p>`;
  try {
    const logQuery = query(
      collection(db, "medicationLog"),
      where("patientId", "==", patientId)
    );
    const presQuery = query(
      collection(db, "prescriptions"),
      where("patientId", "==", patientId),
      where("status", "==", "active")
    );
    const [logSnapshot, presSnapshot] = await Promise.all([
      getDocs(logQuery),
      getDocs(presQuery),
    ]);
    if (presSnapshot.empty) {
      adherenceReportContainer.innerHTML = `<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Active Prescriptions</h4><p class="text-blue-700">${patientName} has no active prescriptions to track.</p></div>`;
      return;
    }
    const takenDoses = new Set();
    logSnapshot.forEach((doc) => {
      const log = doc.data();
      takenDoses.add(`${log.dateTaken}_${log.medicineName}_${log.doseTime}`);
    });
    const reportData = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    presSnapshot.forEach((doc) => {
      const prescription = doc.data();
      const startDate = new Date(prescription.startDate + "T00:00:00");
      prescription.medicines.forEach((med) => {
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + med.totalDays);
        for (
          let d = new Date(startDate);
          d < today && d < endDate;
          d.setDate(d.getDate() + 1)
        ) {
          const dateStr = d.toISOString().split("T")[0];
          if (!reportData[dateStr]) {
            reportData[dateStr] = { taken: [], missed: [] };
          }
          ["morning", "noon", "night"].forEach((doseTime) => {
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
    renderCombinedReport(reportData, patientName);
  } catch (error) {
    console.error("Error loading adherence report: ", error);
    adherenceReportContainer.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load report.</p>';
  }
}

function renderCombinedReport(reportData, patientName) {
  let reportHtml = `<h3 class="text-xl font-bold text-gray-800 mb-4">Adherence Log for: ${patientName}</h3>`;
  const sortedDates = Object.keys(reportData).sort(
    (a, b) => new Date(b) - new Date(a)
  );
  if (sortedDates.length === 0) {
    adherenceReportContainer.innerHTML = `<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Past Data</h4><p class="text-blue-700">No medication was scheduled on past days for ${patientName}.</p></div>`;
    return;
  }
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };
  sortedDates.forEach((date) => {
    const dayData = reportData[date];
    reportHtml += `<div class="mb-4"><h4 class="text-md font-bold text-gray-700 bg-gray-100 p-2 rounded-t-md flex justify-between items-center"><span>${formatDate(
      date
    )}</span>${
      dayData.missed.length === 0
        ? '<span class="text-sm font-semibold text-green-600">Perfect Day!</span>'
        : ""
    }</h4><div class="border rounded-b-md divide-y divide-gray-200">`;
    dayData.taken.forEach((log) => {
      reportHtml += `<div class="p-3 flex items-center"><span class="text-green-500 mr-3">✅</span><div><span class="font-semibold text-gray-800">${log.name}</span><span class="text-sm ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full">${log.doseTime}</span></div></div>`;
    });
    dayData.missed.forEach((log) => {
      reportHtml += `<div class="p-3 flex items-center bg-red-50"><span class="text-red-500 mr-3">❌</span><div><span class="font-semibold text-gray-800">${log.name}</span><span class="text-sm ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full">${log.doseTime}</span></div></div>`;
    });
    reportHtml += `</div></div>`;
  });
  adherenceReportContainer.innerHTML = reportHtml;
}

// --- PRESCRIPTION CREATION LOGIC ---
function addMedicineField() {
  medicineCount++;
  const templateContent = medicineTemplate.content.cloneNode(true);
  const newMedicineDiv = templateContent.firstElementChild;
  newMedicineDiv.querySelector("h4").textContent = `Medicine #${medicineCount}`;
  medicinesContainer.appendChild(newMedicineDiv);
}
medicinesContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-medicine-btn")) {
    e.target.closest(".p-4").remove();
  }
});
addMedicineBtn.addEventListener("click", addMedicineField);
prescriptionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const selectedOption = patientSelect.options[patientSelect.selectedIndex];
  const patientId = selectedOption.value;
  if (!patientId) {
    alert("Please select a patient.");
    return;
  }
  const patientName = selectedOption.dataset.name;
  const medicines = [];
  const medicineDivs = medicinesContainer.querySelectorAll(".p-4");
  if (medicineDivs.length === 0) {
    alert("Please add at least one medicine.");
    return;
  }
  let formIsValid = true;
  medicineDivs.forEach((div) => {
    const nameInput = div.querySelector('[name="medicineName"]');
    const daysInput = div.querySelector('[name="totalDays"]');
    if (!nameInput.value || !daysInput.value) {
      formIsValid = false;
    }
    medicines.push({
      name: nameInput.value,
      totalDays: parseInt(daysInput.value),
      dose: {
        morning: div.querySelector('[name="doseMorning"]').checked ? 1 : 0,
        noon: div.querySelector('[name="doseNoon"]').checked ? 1 : 0,
        night: div.querySelector('[name="doseNight"]').checked ? 1 : 0,
      },
      stockCount: 0,
      remainingCount: 0,
    });
  });
  if (!formIsValid) {
    alert("Please fill out all fields for each medicine.");
    return;
  }
  try {
    await addDoc(collection(db, "prescriptions"), {
      patientId,
      patientName,
      doctorId,
      doctorName,
      startDate: new Date().toISOString().split("T")[0],
      status: "active",
      medicines,
    });
    successMessage.textContent = "Prescription saved successfully!";
    prescriptionForm.reset();
    medicinesContainer.innerHTML = "";
    medicineCount = 0;
    addMedicineField();
    setTimeout(() => {
      successMessage.textContent = "";
    }, 3000);
  } catch (error) {
    console.error("Error adding prescription: ", error);
    alert("Failed to save prescription.");
  }
});
