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
const prescriptionsList = document.getElementById("prescriptions-list");
const todaysMedsList = document.getElementById("todays-meds-list");
const appointmentsList = document.getElementById("appointments-list"); // For appointment status
const notificationsList = document.getElementById("notifications-list"); // For all notifications
const logoutButton = document.getElementById("logout-button");
const welcomeName = document.getElementById("welcome-name");

let currentUserId;
let currentUserName;
let allPrescriptions = [];

// --- AUTHENTICATION & MASTER DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    const userDocRef = doc(db, "users", currentUserId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists() && userDoc.data().role === "patient") {
      currentUserName = userDoc.data().name;
      welcomeName.textContent = `Welcome, ${currentUserName}!`;
      // This single function now loads all data for the dashboard
      await loadAllPatientData(currentUserId);
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

// --- MASTER REFRESH FUNCTION ---
async function loadAllPatientData(patientId) {
  await Promise.all([
    loadPrescriptionsAndLogs(patientId),
    loadMyAppointments(patientId),
    loadPatientNotifications(patientId),
  ]);
}

// --- LOGOUT LOGIC ---
logoutButton.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "/login.html";
  });
});

// --- PRESCRIPTION & LOGS LOADING ---
async function loadPrescriptionsAndLogs(patientId) {
  todaysMedsList.innerHTML =
    '<p class="text-center text-gray-500">Loading schedule...</p>';
  prescriptionsList.innerHTML =
    '<p class="text-center text-gray-500">Loading prescriptions...</p>';

  try {
    const presQuery = query(
      collection(db, "prescriptions"),
      where("patientId", "==", patientId),
      where("status", "==", "active")
    );
    const presSnapshot = await getDocs(presQuery);
    allPrescriptions = presSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (allPrescriptions.length === 0) {
      todaysMedsList.innerHTML =
        '<p class="text-center text-gray-500">No medication scheduled today.</p>';
      prescriptionsList.innerHTML =
        '<p class="text-center text-gray-500">You have no active prescriptions.</p>';
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const logsQuery = query(
      collection(db, "medicationLog"),
      where("patientId", "==", patientId),
      where("dateTaken", "==", todayStr)
    );
    const logsSnapshot = await getDocs(logsQuery);
    const todaysLogs = logsSnapshot.docs.map((doc) => doc.data());

    generateTodaysMedication(allPrescriptions, todaysLogs);
    renderFullPrescriptions(allPrescriptions);
  } catch (error) {
    console.error("Error loading prescription data: ", error);
  }
}

// --- RENDER TODAY'S MEDICATION (GROUPED) ---
function generateTodaysMedication(prescriptions, todaysLogs) {
  todaysMedsList.innerHTML = "";
  const morningMeds = [],
    noonMeds = [],
    nightMeds = [];

  prescriptions.forEach((pres) => {
    pres.medicines.forEach((med, index) => {
      if (med.stockCount === 0 || med.remainingCount === 0) return;
      const createDoseHtml = (doseTime) => {
        const hasTaken = todaysLogs.some(
          (log) => log.medicineName === med.name && log.doseTime === doseTime
        );
        return `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md"><span class="font-semibold text-gray-800">${
          med.name
        }</span><label class="flex items-center cursor-pointer"><input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600 take-dose-cb" ${
          hasTaken ? "checked disabled" : ""
        } data-prescription-id="${
          pres.id
        }" data-medicine-index="${index}" data-medicine-name="${
          med.name
        }" data-dose-time="${doseTime}"><span class="ml-2 text-sm font-medium ${
          hasTaken ? "text-green-600" : "text-gray-700"
        }">${hasTaken ? "Taken" : "Mark as Taken"}</span></label></div>`;
      };
      if (med.dose.morning) morningMeds.push(createDoseHtml("morning"));
      if (med.dose.noon) noonMeds.push(createDoseHtml("noon"));
      if (med.dose.night) nightMeds.push(createDoseHtml("night"));
    });
  });

  const buildSection = (title, medsArray) => {
    if (medsArray.length === 0) return "";
    return `<div class="mb-4"><h3 class="text-lg font-bold text-gray-600 border-b pb-2 mb-3">${title}</h3><div class="space-y-2">${medsArray.join(
      ""
    )}</div></div>`;
  };
  const finalHtml =
    buildSection("☀️ Morning", morningMeds) +
    buildSection("🕛 Noon", noonMeds) +
    buildSection("🌙 Night", nightMeds);
  todaysMedsList.innerHTML =
    finalHtml.trim() === ""
      ? '<p class="text-center text-gray-500">No medication scheduled for today, or stock needs to be added.</p>'
      : finalHtml;
}

// --- RENDER FULL PRESCRIPTION CARDS ---
function renderFullPrescriptions(prescriptions) {
  prescriptionsList.innerHTML = "";
  prescriptions.forEach((pres) => {
    const card = document.createElement("div");
    card.className = "bg-white p-6 rounded-lg shadow-md prescription-card";
    card.dataset.id = pres.id;
    let medicinesHtml = '<ul class="mt-2 space-y-4">';
    pres.medicines.forEach((med, index) => {
      const doses = [];
      if (med.dose.morning) doses.push("Morning");
      if (med.dose.noon) doses.push("Noon");
      if (med.dose.night) doses.push("Night");
      let stockHtml = "";
      if (med.stockCount > 0) {
        stockHtml = `<div class="text-sm font-semibold ${
          med.remainingCount <= 5 ? "text-red-500" : "text-blue-600"
        }">Stock: ${med.remainingCount} / ${med.stockCount} pills</div>`;
      } else {
        stockHtml = `<div class="mt-2 flex items-center gap-2"><input type="number" placeholder="How many pills bought?" min="1" class="stock-input shadow-sm border-gray-300 rounded-md p-2 text-sm w-48" data-index="${index}"><button class="save-stock-btn bg-blue-500 hover:bg-blue-700 text-white font-bold text-sm py-2 px-3 rounded" data-index="${index}">Save</button></div>`;
      }
      medicinesHtml += `<li class="p-3 bg-gray-50 rounded-md border"><div class="flex justify-between items-center"><div><strong>${
        med.name
      }</strong> - for ${
        med.totalDays
      } days<br><span class="text-sm text-gray-600">Dose: ${doses.join(
        ", "
      )}</span></div>${stockHtml}</div></li>`;
    });
    medicinesHtml += "</ul>";
    card.innerHTML = `<div class="flex justify-between items-start"><div><h3 class="text-xl font-bold text-gray-800">Prescription from Dr. ${
      pres.doctorName
    }</h3><p class="text-sm text-gray-500">Date: ${
      pres.startDate
    }</p></div><span class="text-sm font-semibold py-1 px-3 rounded-full ${
      pres.status === "active"
        ? "bg-green-200 text-green-800"
        : "bg-gray-200 text-gray-800"
    }">${
      pres.status
    }</span></div><div class="mt-4"><h4 class="font-semibold text-gray-700">Medicines:</h4>${medicinesHtml}</div>`;
    prescriptionsList.appendChild(card);
  });
}

// --- GLOBAL EVENT LISTENERS FOR DYNAMIC CONTENT ---
document.addEventListener("click", async (e) => {
  // Listener for taking a dose
  if (e.target.classList.contains("take-dose-cb") && e.target.checked) {
    const checkbox = e.target;
    checkbox.disabled = true;
    const { prescriptionId, medicineIndex, medicineName, doseTime } =
      checkbox.dataset;
    await handleDoseTaken(
      prescriptionId,
      parseInt(medicineIndex),
      medicineName,
      doseTime
    );
  }
  // Listener for saving stock
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
    const stockValue = parseInt(input.value, 10);
    if (stockValue > 0) {
      await saveStockCount(prescriptionId, medicineIndex, stockValue);
      await loadAllPatientData(currentUserId);
    } else {
      alert("Please enter a valid stock number.");
      button.disabled = false;
      button.textContent = "Save";
    }
  }
});

// --- HANDLE DOSE TAKEN & NOTIFICATION LOGIC ---
async function handleDoseTaken(prescriptionId, medIndex, medName, doseTime) {
  const prescription = allPrescriptions.find((p) => p.id === prescriptionId);
  if (!prescription) return;

  const medicine = prescription.medicines[medIndex];
  const newRemainingCount = medicine.remainingCount - 1;

  const batch = writeBatch(db);
  const logRef = doc(collection(db, "medicationLog"));
  batch.set(logRef, {
    patientId: currentUserId,
    prescriptionId: prescriptionId,
    medicineName: medName,
    doseTime: doseTime,
    dateTaken: new Dtate().toISOString().split("T")[0],
    timestamp: new Date(),
  });

  const presDocRef = doc(db, "prescriptions", prescriptionId);
  const updatedMedicines = [...prescription.medicines];
  updatedMedicines[medIndex].remainingCount = newRemainingCount;
  batch.update(presDocRef, { medicines: updatedMedicines });

  try {
    await batch.commit();
    console.log("Dose logged and stock updated successfully.");

    // Create low stock notification for the patient when stock hits 5
    if (newRemainingCount === 5) {
      await createPatientNotification(
        "low_stock",
        `Your stock for ${medName} is running low. Contact your pharmacy.`
      );
    }
    await loadAllPatientData(currentUserId);
  } catch (error) {
    console.error("Failed to log dose: ", error);
    alert(
      "There was an error saving your action. Please refresh and try again."
    );
  }
}

// --- SAVE STOCK COUNT ---
async function saveStockCount(prescriptionId, medicineIndex, stockValue) {
  const presDocRef = doc(db, "prescriptions", prescriptionId);
  try {
    const presDoc = await getDoc(presDocRef);
    if (!presDoc.exists()) throw new Error("Doc not found");
    const updatedMedicines = [...presDoc.data().medicines];
    updatedMedicines[medicineIndex].stockCount = stockValue;
    updatedMedicines[medicineIndex].remainingCount = stockValue;
    await updateDoc(presDocRef, { medicines: updatedMedicines });
  } catch (error) {
    console.error("Error updating stock count: ", error);
  }
}

// --- APPOINTMENT VIEWING ---
async function loadMyAppointments(patientId) {
  appointmentsList.innerHTML =
    '<p class="text-center text-gray-500">Loading appointments...</p>';
  try {
    const q = query(
      collection(db, "appointments"),
      where("patientId", "==", patientId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      appointmentsList.innerHTML =
        '<p class="text-center text-gray-500">You have not booked any appointments.</p>';
      return;
    }
    appointmentsList.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const appointment = doc.data();
      const appointmentCard = createAppointmentCard(appointment);
      appointmentsList.appendChild(appointmentCard);
    });
  } catch (error) {
    console.error("Error loading appointments: ", error);
  }
}

function createAppointmentCard(appointment) {
  const card = document.createElement("div");
  let statusClass = "bg-yellow-100 text-yellow-800";
  if (appointment.status === "confirmed")
    statusClass = "bg-green-100 text-green-800";
  if (appointment.status === "rejected")
    statusClass = "bg-red-100 text-red-800";
  card.className = "p-4 rounded-lg flex justify-between items-center border";
  card.innerHTML = `<div><p class="font-bold text-gray-800">Appointment with ${
    appointment.doctorName
  }</p><p class="text-sm text-gray-600">${new Date(
    appointment.slotDateTime
  ).toLocaleString()}</p></div><span class="text-sm font-semibold py-1 px-3 rounded-full ${statusClass}">${
    appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)
  }</span>`;
  return card;
}

// --- PATIENT NOTIFICATION SYSTEM ---
async function createPatientNotification(type, message) {
  try {
    await addDoc(collection(db, "notifications"), {
      type: type,
      targetUserId: currentUserId,
      message: message,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating patient notification: ", error);
  }
}

async function loadPatientNotifications(patientId) {
  notificationsList.innerHTML =
    '<p class="text-center text-gray-500">Loading...</p>';
  try {
    const q = query(
      collection(db, "notifications"),
      where("targetUserId", "==", patientId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      notificationsList.innerHTML =
        '<p class="text-center text-gray-500">No new notifications.</p>';
      return;
    }
    notificationsList.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const notification = doc.data();
      const notificationCard = createPatientNotificationCard(notification);
      notificationsList.appendChild(notificationCard);
    });
  } catch (error) {
    console.error("Error loading notifications:", error);
  }
}

function createPatientNotificationCard(notification) {
  const card = document.createElement("div");
  let icon = "🔔"; // Default
  if (notification.type === "low_stock") icon = "💊";
  if (notification.type === "pharmacy_offer") icon = "💰";
  if (notification.type === "appointment_confirmed") icon = "✅";
  if (notification.type === "appointment_rejected") icon = "❌";

  card.className = "p-3 flex items-start gap-3 border-b";
  card.innerHTML = `
        <span class="text-xl mt-1">${icon}</span>
        <div>
            <p class="text-sm text-gray-800">${notification.message}</p>
            <p class="text-xs text-gray-500">${notification.createdAt
              ?.toDate()
              .toLocaleDateString()}</p>
        </div>
    `;
  return card;
}
