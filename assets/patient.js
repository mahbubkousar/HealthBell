import { auth, db } from "../firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
  orderBy,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DOM Element References ---
const dashboardContent = document.getElementById("dashboard-content");
const dashboardTemplate = document.getElementById("dashboard-template");
const logoutButton = document.getElementById("logout-button");
const welcomeName = document.getElementById("welcome-name");

let currentUserId, currentUserName;

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    const userDocRef = doc(db, "users", currentUserId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists() && userDoc.data().role === "patient") {
      currentUserName = userDoc.data().name;
      welcomeName.textContent = `Welcome, ${currentUserName}!`;
      await refreshDashboard(); // The single point of truth for loading/reloading
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

// --- MASTER REFRESH FUNCTION ---
async function refreshDashboard() {
  // Show a single loading message while fetching all data
  dashboardContent.innerHTML =
    '<p class="text-center text-gray-500 text-lg">Loading Dashboard...</p>';

  try {
    // Fetch all data in parallel for efficiency
    const todayStr = new Date().toISOString().split("T")[0];
    const presQuery = query(
      collection(db, "prescriptions"),
      where("patientId", "==", currentUserId),
      where("status", "==", "active")
    );
    const logsQuery = query(
      collection(db, "medicationLog"),
      where("patientId", "==", currentUserId),
      where("dateTaken", "==", todayStr)
    );
    const apptQuery = query(
      collection(db, "appointments"),
      where("patientId", "==", currentUserId),
      orderBy("createdAt", "desc")
    );

    const [presSnapshot, logsSnapshot, apptSnapshot] = await Promise.all([
      getDocs(presQuery),
      getDocs(logsQuery),
      getDocs(apptQuery),
    ]);

    const allPrescriptions = presSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const todaysLogs = logsSnapshot.docs.map((doc) => doc.data());
    const allAppointments = apptSnapshot.docs.map((doc) => doc.data());

    // Clone the template and get the containers
    const templateNode = dashboardTemplate.content.cloneNode(true);
    dashboardContent.innerHTML = "";
    dashboardContent.appendChild(templateNode);

    const todaysMedsList = document.getElementById("todays-meds-list");
    const prescriptionsList = document.getElementById("prescriptions-list");
    const appointmentsList = document.getElementById("appointments-list");

    // Render each section with the fetched data
    renderTodaysMedication(allPrescriptions, todaysLogs, todaysMedsList);
    renderFullPrescriptions(allPrescriptions, prescriptionsList);
    renderAppointments(allAppointments, appointmentsList);
  } catch (error) {
    console.error("Error refreshing dashboard: ", error);
    dashboardContent.innerHTML =
      '<p class="text-center text-red-500">Could not load dashboard data. Please try again later.</p>';
  }
}

// --- RENDER TODAY'S MEDICATION ---
function renderTodaysMedication(prescriptions, todaysLogs, container) {
  container.innerHTML = "";
  const morningMeds = [],
    noonMeds = [],
    nightMeds = [];
  prescriptions.forEach((pres) => {
    pres.medicines.forEach((med, index) => {
      if (med.stockCount > 0 && med.remainingCount > 0) {
        const createDoseHtml = (doseTime) => {
          const hasTaken = todaysLogs.some(
            (log) => log.medicineName === med.name && log.doseTime === doseTime
          );
          return `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md"><span class="font-semibold">${
            med.name
          }</span><label class="flex items-center cursor-pointer"><input type="checkbox" class="form-checkbox h-5 w-5 take-dose-cb" ${
            hasTaken ? "checked disabled" : ""
          } data-prescription-id="${
            pres.id
          }" data-medicine-index="${index}" data-medicine-name="${
            med.name
          }" data-dose-time="${doseTime}"><span class="ml-2 text-sm ${
            hasTaken ? "text-green-600" : "text-gray-700"
          }">${hasTaken ? "Taken" : "Mark as Taken"}</span></label></div>`;
        };
        if (med.dose.morning) morningMeds.push(createDoseHtml("morning"));
        if (med.dose.noon) noonMeds.push(createDoseHtml("noon"));
        if (med.dose.night) nightMeds.push(createDoseHtml("night"));
      }
    });
  });
  const buildSection = (title, medsArray) =>
    medsArray.length > 0
      ? `<div class="mb-4"><h3 class="text-lg font-bold text-gray-600 border-b pb-2 mb-3">${title}</h3><div class="space-y-2">${medsArray.join(
          ""
        )}</div></div>`
      : "";
  const finalHtml =
    buildSection("☀️ Morning", morningMeds) +
    buildSection("🕛 Noon", noonMeds) +
    buildSection("🌙 Night", nightMeds);
  container.innerHTML =
    finalHtml.trim() === ""
      ? '<p class="text-center text-gray-500">No medication scheduled for today, or stock needs to be added.</p>'
      : finalHtml;
}

// --- RENDER FULL PRESCRIPTION CARDS ---
function renderFullPrescriptions(prescriptions, container) {
  container.innerHTML = "";
  if (prescriptions.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-500">You have no active prescriptions.</p>';
    return;
  }
  prescriptions.forEach((pres) => {
    const card = document.createElement("div");
    card.className = "bg-white p-6 rounded-lg shadow-md prescription-card";
    card.dataset.id = pres.id;
    let medicinesHtml = '<ul class="mt-2 space-y-4">';
    pres.medicines.forEach((med, index) => {
      const doses = Object.keys(med.dose)
        .filter((d) => med.dose[d] > 0)
        .join(", ");
      let stockHtml =
        med.stockCount > 0
          ? `<div class="text-sm font-semibold ${
              med.remainingCount <= 5 ? "text-red-500" : "text-blue-600"
            }">Stock: ${med.remainingCount} / ${med.stockCount}</div>`
          : `<div class="mt-2 flex items-center gap-2"><input type="number" placeholder="Pills bought?" min="1" class="stock-input p-2 text-sm w-32 border rounded-md" data-index="${index}"><button class="save-stock-btn bg-blue-500 text-white text-sm py-2 px-3 rounded" data-index="${index}">Save</button></div>`;
      medicinesHtml += `<li class="p-3 bg-gray-50 rounded-md border"><div class="flex justify-between items-center"><div><strong>${med.name}</strong> <span class="text-sm text-gray-500">- for ${med.totalDays} days</span><br><span class="text-sm text-gray-600">Dose: ${doses}</span></div>${stockHtml}</div></li>`;
    });
    medicinesHtml += "</ul>";
    card.innerHTML = `<div class="flex justify-between"><div><h3 class="text-xl font-bold">Dr. ${pres.doctorName}</h3><p class="text-sm text-gray-500">${pres.startDate}</p></div><span class="text-sm font-semibold py-1 px-3 rounded-full bg-green-200 text-green-800">${pres.status}</span></div><div class="mt-4">${medicinesHtml}</div>`;
    container.appendChild(card);
  });
}

// --- RENDER APPOINTMENTS ---
function renderAppointments(appointments, container) {
  container.innerHTML = "";
  if (appointments.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-500">You have not booked any appointments.</p>';
    return;
  }
  appointments.forEach((appt) => {
    let statusClass = "bg-yellow-100 text-yellow-800";
    if (appt.status === "confirmed")
      statusClass = "bg-green-100 text-green-800";
    else if (appt.status === "rejected")
      statusClass = "bg-red-100 text-red-800";
    const card = document.createElement("div");
    card.className = `p-4 rounded-lg flex justify-between items-center border`;
    card.innerHTML = `<div><p class="font-bold">${
      appt.doctorName
    }</p><p class="text-sm text-gray-600">${new Date(
      appt.slotDateTime
    ).toLocaleString()}</p></div><span class="text-sm font-semibold py-1 px-3 rounded-full ${statusClass}">${
      appt.status
    }</span>`;
    container.appendChild(card);
  });
}

// --- EVENT LISTENERS & HANDLERS ---
document.addEventListener("click", async (e) => {
  // Take a dose
  if (e.target.classList.contains("take-dose-cb") && e.target.checked) {
    e.target.disabled = true;
    const { prescriptionId, medicineIndex, medicineName, doseTime } =
      e.target.dataset;
    await handleDoseTaken(
      prescriptionId,
      parseInt(medicineIndex),
      medicineName,
      doseTime
    );
  }
  // Save stock
  else if (e.target.classList.contains("save-stock-btn")) {
    const button = e.target;
    button.disabled = true;
    button.textContent = "Saving...";
    const card = button.closest(".prescription-card");
    const prescriptionId = card.dataset.id;
    const medicineIndex = button.dataset.index;
    const input = card.querySelector(
      `input.stock-input[data-index='${medicineIndex}']`
    );
    if (parseInt(input.value, 10) > 0) {
      await saveStockCount(
        prescriptionId,
        medicineIndex,
        parseInt(input.value, 10)
      );
    } else {
      alert("Please enter a valid stock number.");
      button.disabled = false;
      button.textContent = "Save";
    }
  }
  // Logout
  else if (e.target.id === "logout-button") {
    signOut(auth).then(() => (window.location.href = "/login.html"));
  }
});

async function handleDoseTaken(prescriptionId, medIndex, medName, doseTime) {
  const presDocRef = doc(db, "prescriptions", prescriptionId);
  try {
    const presDoc = await getDoc(presDocRef);
    if (!presDoc.exists()) throw new Error("Prescription not found");

    const prescription = presDoc.data();
    const medicine = prescription.medicines[medIndex];
    const newRemainingCount = medicine.remainingCount - 1;

    const batch = writeBatch(db);
    const logRef = doc(collection(db, "medicationLog"));
    batch.set(logRef, {
      patientId: currentUserId,
      medicineName: medName,
      doseTime,
      dateTaken: new Date().toISOString().split("T")[0],
      timestamp: new Date(),
    });

    const updatedMedicines = [...prescription.medicines];
    updatedMedicines[medIndex].remainingCount = newRemainingCount;
    batch.update(presDocRef, { medicines: updatedMedicines });

    await batch.commit();

    if (newRemainingCount <= 5 && newRemainingCount > 0) {
      await addDoc(collection(db, "notifications"), {
        type: "low_stock",
        patientId: currentUserId,
        patientName: currentUserName,
        medicineName: medName,
        message: `Patient ${currentUserName} is running low on ${medName}.`,
        targetRole: "pharmacy",
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }
    await refreshDashboard(); // REFRESH THE WHOLE DASHBOARD
  } catch (error) {
    console.error("Failed to log dose: ", error);
    alert("There was an error saving your action.");
    await refreshDashboard(); // Also refresh on error to reset UI
  }
}

async function saveStockCount(prescriptionId, medicineIndex, stockValue) {
  const presDocRef = doc(db, "prescriptions", prescriptionId);
  try {
    const presDoc = await getDoc(presDocRef);
    if (!presDoc.exists()) throw new Error("Doc not found");
    const updatedMedicines = [...presDoc.data().medicines];
    updatedMedicines[medicineIndex].stockCount = stockValue;
    updatedMedicines[medicineIndex].remainingCount = stockValue;
    await updateDoc(presDocRef, { medicines: updatedMedicines });
    await refreshDashboard(); // REFRESH THE WHOLE DASHBOARD
  } catch (error) {
    console.error("Error updating stock count: ", error);
    alert("Failed to update stock.");
    await refreshDashboard(); // Also refresh on error to reset UI
  }
}
