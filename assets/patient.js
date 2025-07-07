import { auth, db } from "../firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Corrected version
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
const logoutButton = document.getElementById("logout-button");
const welcomeName = document.getElementById("welcome-name");
const appointmentsList = document.getElementById("appointments-list"); // Add this
let currentUserId;
let currentUserName; // NEW: To store the patient's name for notifications
let allPrescriptions = [];

// --- AUTHENTICATION & DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    const userDocRef = doc(db, "users", currentUserId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists() && userDoc.data().role === "patient") {
      currentUserName = userDoc.data().name; // Store patient's name
      welcomeName.textContent = `Welcome, ${currentUserName}!`;
      await loadPrescriptionsAndLogs(currentUserId);
      // Inside onAuthStateChanged, after loading prescriptions and logs
      await loadMyAppointments(currentUserId); // Add this line
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "/login.html";
  });
});

// --- HANDLE DOSE TAKEN (MODIFIED) ---
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
    dateTaken: new Date().toISOString().split("T")[0],
    timestamp: new Date(),
  });

  const presDocRef = doc(db, "prescriptions", prescriptionId);
  const updatedMedicines = [...prescription.medicines];
  updatedMedicines[medIndex].remainingCount = newRemainingCount;
  batch.update(presDocRef, { medicines: updatedMedicines });

  try {
    await batch.commit();
    console.log("Dose logged and stock updated successfully.");

    // *** NEW: LOW STOCK NOTIFICATION LOGIC ***
    if (newRemainingCount <= 5 && newRemainingCount > 0) {
      // Check if stock is low but not yet zero
      console.log(
        `LOW STOCK WARNING for ${medName}! Remaining: ${newRemainingCount}. Notifying pharmacy...`
      );
      await createLowStockNotification(medName);
    }

    await loadPrescriptionsAndLogs(currentUserId);
  } catch (error) {
    console.error("Failed to log dose: ", error);
    alert(
      "There was an error saving your action. Please refresh and try again."
    );
  }
}

// --- CREATE LOW STOCK NOTIFICATION (NEW) ---
async function createLowStockNotification(medicineName) {
  try {
    await addDoc(collection(db, "notifications"), {
      type: "low_stock",
      patientId: currentUserId,
      patientName: currentUserName,
      medicineName: medicineName,
      message: `Patient ${currentUserName} is running low on ${medicineName}.`,
      targetRole: "pharmacy", // Target all pharmacies
      isRead: false,
      createdAt: serverTimestamp(), // Use server time for consistency
    });
    console.log("Low stock notification created.");
  } catch (error) {
    console.error("Error creating notification: ", error);
  }
}

// ... (The rest of the file remains exactly the same) ...

// --- MASTER LOADING FUNCTION ---
async function loadPrescriptionsAndLogs(patientId) {
  todaysMedsList.innerHTML =
    '<p class="text-center text-gray-500">Loading today\'s schedule...</p>';
  prescriptionsList.innerHTML =
    '<p class="text-center text-gray-500">Loading your prescriptions...</p>';

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
        '<p class="text-center text-gray-500">No medication scheduled for today.</p>';
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
    console.error("Error loading data: ", error);
    todaysMedsList.innerHTML =
      '<p class="text-center text-red-500">Could not load schedule.</p>';
    prescriptionsList.innerHTML =
      '<p class="text-center text-red-500">Could not load prescriptions.</p>';
  }
}

// --- RENDER TODAY'S MEDICATION ---
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
        return `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span class="font-semibold text-gray-800">${
                          med.name
                        }</span>
                        <label class="flex items-center cursor-pointer"><input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600 take-dose-cb" 
                                   ${
                                     hasTaken ? "checked disabled" : ""
                                   } data-prescription-id="${
          pres.id
        }" data-medicine-index="${index}" data-medicine-name="${
          med.name
        }" data-dose-time="${doseTime}">
                            <span class="ml-2 text-sm font-medium ${
                              hasTaken ? "text-green-600" : "text-gray-700"
                            }">${
          hasTaken ? "Taken" : "Mark as Taken"
        }</span></label></div>`;
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
        stockHtml = `<div class="mt-2 flex items-center gap-2">
                    <input type="number" placeholder="How many pills bought?" min="1" class="stock-input shadow-sm border-gray-300 rounded-md p-2 text-sm w-48" data-index="${index}">
                    <button class="save-stock-btn bg-blue-500 hover:bg-blue-700 text-white font-bold text-sm py-2 px-3 rounded" data-index="${index}">Save</button>
                </div>`;
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

// --- EVENT LISTENERS ---
document.addEventListener("click", async (e) => {
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
  } else if (e.target.classList.contains("save-stock-btn")) {
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
      await loadPrescriptionsAndLogs(currentUserId);
    } else {
      alert("Please enter a valid stock number.");
      button.disabled = false;
      button.textContent = "Save";
    }
  }
});

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
    alert("Failed to update stock. Please try again.");
  }
}

// Add this entire block of code to the end of assets/patient.js

// --- LOAD AND DISPLAY PATIENT'S APPOINTMENTS ---
async function loadMyAppointments(patientId) {
  appointmentsList.innerHTML =
    '<p class="text-center text-gray-500">Loading your appointments...</p>';

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
    appointmentsList.innerHTML =
      '<p class="text-center text-red-500">Could not load appointments.</p>';
  }
}

function createAppointmentCard(appointment) {
  const card = document.createElement("div");

  let statusClass = "bg-yellow-100 text-yellow-800";
  if (appointment.status === "confirmed") {
    statusClass = "bg-green-100 text-green-800";
  } else if (appointment.status === "rejected") {
    statusClass = "bg-red-100 text-red-800";
  }

  card.className = "p-4 rounded-lg flex justify-between items-center border";
  card.innerHTML = `
        <div>
            <p class="font-bold text-gray-800">Appointment with ${
              appointment.doctorName
            }</p>
            <p class="text-sm text-gray-600">${new Date(
              appointment.slotDateTime
            ).toLocaleString()}</p>
        </div>
        <span class="text-sm font-semibold py-1 px-3 rounded-full ${statusClass}">
            ${
              appointment.status.charAt(0).toUpperCase() +
              appointment.status.slice(1)
            }
        </span>
    `;
  return card;
}
