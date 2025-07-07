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
); // NEW

let doctorId, doctorName;
let medicineCount = 0;

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists() && userDoc.data().role === "doctor") {
      doctorId = user.uid;
      doctorName = userDoc.data().name;
      // Load all necessary data on login
      loadPatients();
      loadAppointmentRequests();
      loadUpcomingAppointments(); // NEW
      addMedicineField();
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "/login.html"));
});

// --- APPOINTMENT MANAGEMENT LOGIC ---
async function loadAppointmentRequests() {
  appointmentRequestsContainer.innerHTML =
    '<p class="text-center text-gray-500">Loading requests...</p>';
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
        '<p class="text-center text-gray-500">No pending appointment requests.</p>';
      return;
    }

    appointmentRequestsContainer.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const request = doc.data();
      const requestCard = document.createElement("div");
      requestCard.className =
        "p-4 border rounded-lg bg-gray-50 appointment-card";
      requestCard.dataset.id = doc.id;
      requestCard.innerHTML = `
                <p class="font-semibold text-gray-800">${
                  request.patientName
                }</p>
                <p class="text-sm text-gray-600">${new Date(
                  request.slotDateTime
                ).toLocaleString()}</p>
                <div class="mt-3 flex gap-2">
                    <button class="approve-btn bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-1 px-3 rounded" data-id="${
                      doc.id
                    }">Approve</button>
                    <button class="reject-btn bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded" data-id="${
                      doc.id
                    }">Reject</button>
                </div>
            `;
      appointmentRequestsContainer.appendChild(requestCard);
    });
  } catch (error) {
    console.error("Error loading appointment requests: ", error);
    appointmentRequestsContainer.innerHTML =
      '<p class="text-center text-red-500">Could not load requests. An index may be required.</p>';
  }
}

appointmentRequestsContainer.addEventListener("click", async (e) => {
  const button = e.target;
  const appointmentId = button.dataset.id;
  if (!appointmentId) return;

  let newStatus = "";
  if (button.classList.contains("approve-btn")) {
    newStatus = "confirmed";
  } else if (button.classList.contains("reject-btn")) {
    newStatus = "rejected";
  }

  if (newStatus) {
    try {
      const appointmentRef = doc(db, "appointments", appointmentId);
      await updateDoc(appointmentRef, { status: newStatus });
      button.closest(".appointment-card").remove(); // Remove the card from the list
      loadUpcomingAppointments(); // Refresh upcoming list after approval
    } catch (error) {
      console.error("Error updating appointment status: ", error);
      alert("Failed to update status. Please try again.");
    }
  }
});

// --- NEW FUNCTION: LOAD UPCOMING APPOINTMENTS ---
async function loadUpcomingAppointments() {
  upcomingAppointmentsContainer.innerHTML =
    '<p class="text-center text-gray-500">Loading schedule...</p>';
  try {
    const now = new Date().toISOString();
    const q = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId),
      where("status", "==", "confirmed"),
      where("slotDateTime", ">=", now),
      orderBy("slotDateTime", "asc")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      upcomingAppointmentsContainer.innerHTML =
        '<p class="text-center text-gray-500">No upcoming appointments.</p>';
      return;
    }

    upcomingAppointmentsContainer.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const appointment = doc.data();
      const appointmentCard = document.createElement("div");
      appointmentCard.className = "p-4 border rounded-lg bg-blue-50";
      appointmentCard.innerHTML = `
                <p class="font-semibold text-blue-800">${
                  appointment.patientName
                }</p>
                <p class="text-sm text-blue-600">${new Date(
                  appointment.slotDateTime
                ).toLocaleString()}</p>
            `;
      upcomingAppointmentsContainer.appendChild(appointmentCard);
    });
  } catch (error) {
    console.error("Error loading upcoming appointments: ", error);
    upcomingAppointmentsContainer.innerHTML =
      '<p class="text-center text-red-500">Could not load upcoming appointments. A Firestore index is required.</p>';
  }
}

// --- All other functions (loadPatients, adherence report, prescription creation) remain unchanged ---
async function loadPatients() {
  try {
    const e = query(collection(db, "users"), where("role", "==", "patient"));
    const t = await getDocs(e);
    const o = '<option value="">Select a patient</option>';
    (patientSelect.innerHTML = o),
      (patientAdherenceSelect.innerHTML = o),
      t.forEach((e) => {
        const t = e.data(),
          o = document.createElement("option");
        (o.value = e.id),
          (o.textContent = t.name),
          (o.dataset.name = t.name),
          patientSelect.appendChild(o.cloneNode(!0)),
          patientAdherenceSelect.appendChild(o.cloneNode(!0));
      });
  } catch (e) {
    console.error("Error loading patients: ", e);
  }
}
patientAdherenceSelect.addEventListener("change", (e) => {
  const t = e.target.value,
    o = e.target.options[e.target.selectedIndex].text;
  t
    ? loadAdherenceReport(t, o)
    : (adherenceReportContainer.innerHTML =
        '<p class="text-center text-gray-500">Please select a patient.</p>');
});
async function loadAdherenceReport(e, t) {
  adherenceReportContainer.innerHTML = `<p class="text-center text-gray-500">Calculating report for ${t}...</p>`;
  try {
    const o = query(
        collection(db, "medicationLog"),
        where("patientId", "==", e)
      ),
      n = query(
        collection(db, "prescriptions"),
        where("patientId", "==", e),
        where("status", "==", "active")
      );
    const [a, i] = await Promise.all([getDocs(o), getDocs(n)]);
    if (i.empty)
      return void (adherenceReportContainer.innerHTML = `<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Active Prescriptions</h4><p class="text-blue-700">${t} has no active prescriptions to track.</p></div>`);
    const s = new Set();
    a.forEach((e) => {
      const t = e.data();
      s.add(t.dateTaken + "_" + t.medicineName + "_" + t.doseTime);
    });
    const d = {},
      r = new Date();
    r.setHours(0, 0, 0, 0),
      i.forEach((e) => {
        const t = e.data(),
          o = new Date(t.startDate + "T00:00:00");
        t.medicines.forEach((e) => {
          const t = new Date(o);
          t.setDate(o.getDate() + e.totalDays);
          for (
            let l = new Date(o);
            l < r && l < t;
            l.setDate(l.getDate() + 1)
          ) {
            const t = l.toISOString().split("T")[0];
            d[t] || (d[t] = { taken: [], missed: [] }),
              ["morning", "noon", "night"].forEach((o) => {
                if (e.dose[o] > 0) {
                  const r = { name: e.name, doseTime: o };
                  s.has(t + "_" + e.name + "_" + o)
                    ? d[t].taken.push(r)
                    : d[t].missed.push(r);
                }
              });
          }
        });
      }),
      renderCombinedReport(d, t);
  } catch (e) {
    console.error("Error loading adherence report: ", e),
      (adherenceReportContainer.innerHTML =
        '<p class="text-center text-red-500">Could not load report. A Firestore index may be required.</p>');
  }
}
function renderCombinedReport(e, t) {
  let o = `<h3 class="text-xl font-bold text-gray-800 mb-4">Adherence Log for: ${t}</h3>`;
  const n = Object.keys(e).sort((e, t) => new Date(t) - new Date(e));
  if (0 === n.length)
    return void (adherenceReportContainer.innerHTML = `<div class="text-center p-4 bg-blue-50 rounded-lg"><h4 class="font-semibold text-blue-800">No Past Data</h4><p class="text-blue-700">No medication was scheduled on past days for ${t}.</p></div>`);
  const a = (e) => {
    const t = new Date(e + "T00:00:00"),
      o = new Date(),
      n = new Date();
    return (
      n.setDate(n.getDate() - 1),
      t.toDateString() === o.toDateString()
        ? "Today"
        : t.toDateString() === n.toDateString()
        ? "Yesterday"
        : t.toLocaleDateString(void 0, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
    );
  };
  n.forEach((t) => {
    const n = e[t];
    (o +=
      '<div class="mb-4"><h4 class="text-md font-bold text-gray-700 bg-gray-100 p-2 rounded-t-md flex justify-between items-center"><span>' +
      a(t) +
      "</span>" +
      (0 === n.missed.length
        ? '<span class="text-sm font-semibold text-green-600">Perfect Day!</span>'
        : "") +
      '</h4><div class="border rounded-b-md divide-y divide-gray-200">'),
      n.taken.forEach((e) => {
        o +=
          '<div class="p-3 flex items-center"><span class="text-green-500 mr-3">✅</span><div><span class="font-semibold text-gray-800">' +
          e.name +
          '</span><span class="text-sm ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full">' +
          e.doseTime +
          "</span></div></div>";
      }),
      n.missed.forEach((e) => {
        o +=
          '<div class="p-3 flex items-center bg-red-50"><span class="text-red-500 mr-3">❌</span><div><span class="font-semibold text-gray-800">' +
          e.name +
          '</span><span class="text-sm ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full">' +
          e.doseTime +
          "</span></div></div>";
      }),
      (o += "</div></div>");
  }),
    (adherenceReportContainer.innerHTML = o);
}
function addMedicineField() {
  medicineCount++;
  const e = medicineTemplate.content.cloneNode(!0),
    t = e.querySelector(".p-4"),
    o = document.createElement("h4");
  (o.className = "font-semibold text-gray-700"),
    (o.textContent = `Medicine ${medicineCount}`),
    t.prepend(o),
    medicinesContainer.appendChild(t);
}
addMedicineBtn.addEventListener("click", addMedicineField);
prescriptionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = patientSelect.options[patientSelect.selectedIndex],
    o = t.value,
    n = t.dataset.name,
    a = [],
    i = medicinesContainer.querySelectorAll(".p-4.border");
  let d = !0;
  i.forEach((e) => {
    const t = e.querySelector('input[name="medicineName"]').value,
      o = parseInt(e.querySelector('input[name="totalDays"]').value, 10),
      n = e.querySelector('input[name="doseMorning"]').checked,
      i = e.querySelector('input[name="doseNoon"]').checked,
      s = e.querySelector('input[name="doseNight"]').checked;
    n || i || s
      ? (t &&
          o > 0 &&
          a.push({
            name: t,
            totalDays: o,
            dose: { morning: n ? 1 : 0, noon: i ? 1 : 0, night: s ? 1 : 0 },
            stockCount: 0,
            remainingCount: 0,
          }),
        0)
      : alert(
          `Please select at least one dose (Morning, Noon, or Night) for ${t}.`,
          (d = !1)
        );
  }),
    d &&
      (o && 0 !== a.length
        ? (await addDoc(collection(db, "prescriptions"), {
            patientId: o,
            patientName: n,
            doctorId,
            doctorName,
            startDate: new Date().toISOString().split("T")[0],
            status: "active",
            medicines: a,
          }),
          (successMessage.textContent = "Prescription saved successfully!"),
          prescriptionForm.reset(),
          (medicinesContainer.innerHTML = ""),
          (medicineCount = 0),
          addMedicineField(),
          setTimeout(() => {
            successMessage.textContent = "";
          }, 3e3))
        : alert("Please select a patient and fill out all medicine details."));
});
