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
  onSnapshot,
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
// --- To manage our live listeners ---
let unsubscribeAdherence = null;
let unsubscribePendingAppointments = null;
let unsubscribeUpcomingAppointments = null;

// --- AUTHENTICATION & DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().role === "doctor") {
      doctorId = user.uid;
      doctorName = userDoc.data().name;
      await loadStaticDoctorData();
      setupAppointmentListeners();
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

async function loadStaticDoctorData() {
  loadingOverlay.style.display = "flex";
  try {
    await loadPatients();
    addMedicineField();
  } catch (error) {
    console.error("Error loading static doctor data:", error);
  } finally {
    loadingOverlay.style.display = "none";
  }
}

// --- LOGOUT ---
logoutButton.addEventListener("click", () => {
  if (unsubscribeAdherence) unsubscribeAdherence();
  if (unsubscribePendingAppointments) unsubscribePendingAppointments();
  if (unsubscribeUpcomingAppointments) unsubscribeUpcomingAppointments();
  signOut(auth).then(() => (window.location.href = "/login.html"));
});

// --- REAL-TIME APPOINTMENT MANAGEMENT ---
function setupAppointmentListeners() {
  const pendingQuery = query(
    collection(db, "appointments"),
    where("doctorId", "==", doctorId),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );
  unsubscribePendingAppointments = onSnapshot(pendingQuery, (querySnapshot) => {
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
  });

  const today = new Date();
  const inOneWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingQuery = query(
    collection(db, "appointments"),
    where("doctorId", "==", doctorId),
    where("status", "==", "confirmed"),
    where("slotDateTime", ">=", today.toISOString()),
    where("slotDateTime", "<=", inOneWeek.toISOString()),
    orderBy("slotDateTime", "asc")
  );
  unsubscribeUpcomingAppointments = onSnapshot(
    upcomingQuery,
    (querySnapshot) => {
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
    }
  );
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
  } catch (error) {
    console.error("Error updating appointment status: ", error);
    button.disabled = false;
  }
});

// --- REAL-TIME ADHERENCE REPORT ---
patientAdherenceSelect.addEventListener("change", (e) => {
  const patientId = e.target.value;
  const patientName = e.target.options[e.target.selectedIndex].text;
  if (unsubscribeAdherence) unsubscribeAdherence();
  if (patientId) {
    loadAdherenceReport(patientId, patientName);
  } else {
    adherenceReportContainer.innerHTML =
      '<p class="loading-placeholder">Please select a patient to see their adherence history.</p>';
  }
});

function loadAdherenceReport(patientId, patientName) {
  adherenceReportContainer.innerHTML = `<p class="loading-placeholder">Opening live report for ${patientName}...</p>`;
  const logQuery = query(
    collection(db, "medicationLog"),
    where("patientId", "==", patientId)
  );

  unsubscribeAdherence = onSnapshot(
    logQuery,
    async (logSnapshot) => {
      console.log("Real-time update received for adherence report!");
      const presQuery = query(
        collection(db, "prescriptions"),
        where("patientId", "==", patientId),
        where("status", "==", "active")
      );
      const presSnapshot = await getDocs(presQuery);

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

      // --- THE FIX IS HERE ---
      // Create a 'tomorrow' date to ensure the loop includes all of today.
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      presSnapshot.forEach((doc) => {
        const prescription = doc.data();
        const startDate = new Date(prescription.startDate + "T00:00:00");
        prescription.medicines.forEach((med) => {
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + med.totalDays);

          // Loop up to (but not including) tomorrow. This is the robust way.
          for (
            let d = new Date(startDate);
            d < tomorrow && d < endDate;
            d.setDate(d.getDate() + 1)
          ) {
            const dateStr = d.toISOString().split("T")[0];
            if (!reportData[dateStr]) {
              reportData[dateStr] = [];
            }
            ["morning", "noon", "night"].forEach((doseTime) => {
              if (med.dose[doseTime] > 0) {
                const doseKey = `${dateStr}_${med.name}_${doseTime}`;
                const doseEntry = {
                  name: med.name,
                  doseTime: doseTime,
                  status: "",
                };
                if (takenDoses.has(doseKey)) {
                  doseEntry.status = "Taken";
                } else if (d < today) {
                  doseEntry.status = "Missed";
                } else {
                  doseEntry.status = "Pending";
                }
                reportData[dateStr].push(doseEntry);
              }
            });
          }
        });
      });
      renderCombinedReport(reportData, patientName);
    },
    (error) => {
      console.error("Error with adherence listener: ", error);
      adherenceReportContainer.innerHTML =
        '<p class="loading-placeholder text-red-500">Could not load live report.</p>';
    }
  );
}

function renderCombinedReport(reportData, patientName) {
  let reportHtml = `<h3 class="text-xl font-bold text-gray-800 mb-4">Adherence Log for: ${patientName}</h3>`;
  let totalTaken = 0,
    totalMissed = 0;
  const todayStr = new Date().toISOString().split("T")[0];
  for (const date in reportData) {
    if (date < todayStr) {
      const dayData = reportData[date];
      totalTaken += dayData.filter((d) => d.status === "Taken").length;
      totalMissed += dayData.filter((d) => d.status === "Missed").length;
    }
  }
  const totalScheduledPast = totalTaken + totalMissed;
  const adherenceRate =
    totalScheduledPast > 0
      ? ((totalTaken / totalScheduledPast) * 100).toFixed(0)
      : 100;
  reportHtml += `<div class="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border"><div class="text-center"><p class="text-2xl font-bold ${
    adherenceRate >= 80 ? "text-green-600" : "text-orange-500"
  }">${adherenceRate}%</p><p class="text-sm font-semibold text-gray-500">Overall Adherence</p></div><div class="text-center"><p class="text-2xl font-bold text-green-600">${totalTaken}</p><p class="text-sm font-semibold text-gray-500">Doses Taken</p></div><div class="text-center"><p class="text-2xl font-bold text-red-600">${totalMissed}</p><p class="text-sm font-semibold text-gray-500">Doses Missed</p></div></div>`;
  const sortedDates = Object.keys(reportData).sort(
    (a, b) => new Date(b) - new Date(a)
  );
  if (sortedDates.length === 0) {
    adherenceReportContainer.innerHTML = `<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Data Yet</h4><p class="text-blue-700">No medication history found for this patient.</p></div>`;
    return;
  }
  sortedDates.forEach((date) => {
    const dayData = reportData[date];
    const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(
      "en-US",
      { weekday: "long", month: "long", day: "numeric", year: "numeric" }
    );
    reportHtml += `<div class="mb-4"><h4 class="text-md font-bold text-gray-700 bg-gray-100 p-2 rounded-t-md"><span>${formattedDate}</span></h4><div class="border rounded-b-md divide-y divide-gray-200">`;
    dayData.forEach((log) => {
      let statusBadge = "",
        iconHtml = "";
      switch (log.status) {
        case "Taken":
          iconHtml = `<span class="text-green-500 mr-3 w-5 text-center"><i class="fa-solid fa-check-circle"></i></span>`;
          statusBadge = `<span class="text-xs font-bold py-1 px-2 bg-green-100 text-green-700 rounded-full">TAKEN</span>`;
          break;
        case "Missed":
          iconHtml = `<span class="text-red-500 mr-3 w-5 text-center"><i class="fa-solid fa-times-circle"></i></span>`;
          statusBadge = `<span class="text-xs font-bold py-1 px-2 bg-red-100 text-red-700 rounded-full">MISSED</span>`;
          break;
        case "Pending":
          iconHtml = `<span class="text-gray-400 mr-3 w-5 text-center"><i class="fa-solid fa-clock"></i></span>`;
          statusBadge = `<span class="text-xs font-bold py-1 px-2 bg-gray-200 text-gray-700 rounded-full">PENDING</span>`;
          break;
      }
      reportHtml += `<div class="p-3 flex justify-between items-center"><div class="flex items-center">${iconHtml}<span class="font-semibold text-gray-800">${log.name}</span><span class="text-sm ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full">${log.doseTime}</span></div>${statusBadge}</div>`;
    });
    reportHtml += `</div></div>`;
  });
  adherenceReportContainer.innerHTML = reportHtml;
}

// --- STATIC DATA FUNCTIONS ---
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
