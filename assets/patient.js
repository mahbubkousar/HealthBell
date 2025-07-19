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
const loadingOverlay = document.getElementById("loading-overlay");
const prescriptionsList = document.getElementById("prescriptions-list");
const todaysMedsList = document.getElementById("todays-meds-list");
const appointmentsList = document.getElementById("appointments-list");
const notificationsList = document.getElementById("notifications-list");
const logoutButton = document.getElementById("logout-button");
const welcomeName = document.getElementById("welcome-name");

let currentUserId, currentUserName;
let allPrescriptions = [];

// --- AUTHENTICATION & MASTER DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    const userDoc = await getDoc(doc(db, "users", currentUserId));
    if (userDoc.exists() && userDoc.data().role === "patient") {
      currentUserName = userDoc.data().name;
      welcomeName.textContent = currentUserName;
      await loadAllPatientData(currentUserId);
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

async function loadAllPatientData(patientId) {
  loadingOverlay.style.display = "flex";
  try {
    await Promise.all([
      loadPrescriptionsAndLogs(patientId),
      loadMyAppointments(patientId),
      loadPatientNotifications(patientId),
    ]);
  } catch (error) {
    console.error(
      "A critical error occurred while loading dashboard data:",
      error
    );
  } finally {
    loadingOverlay.style.display = "none";
  }
}

// --- LOGOUT ---
logoutButton.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "/login.html";
  });
});

// --- DATA FETCHING & RENDERING FUNCTIONS ---

async function loadPrescriptionsAndLogs(patientId) {
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
    todaysMedsList.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load schedule.</p>';
    prescriptionsList.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load prescriptions.</p>';
  }
}

function generateTodaysMedication(prescriptions, todaysLogs) {
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
        return `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span class="font-semibold text-gray-800">${
                          med.name
                        }</span>
                        <div class="dose-toggle">
                            <label class="toggle-switch">
                                <input type="checkbox" class="take-dose-cb" 
                                    ${hasTaken ? "checked disabled" : ""} 
                                    data-prescription-id="${pres.id}"
                                    data-medicine-index="${index}"
                                    data-medicine-name="${med.name}"
                                    data-dose-time="${doseTime}">
                                <span class="toggle-slider"></span>
                            </label>
                            <span class="toggle-label font-medium">${
                              hasTaken ? "Taken!" : "Mark"
                            }</span>
                        </div>
                    </div>`;
      };
      if (med.dose.morning) morningMeds.push(createDoseHtml("morning"));
      if (med.dose.noon) noonMeds.push(createDoseHtml("noon"));
      if (med.dose.night) nightMeds.push(createDoseHtml("night"));
    });
  });
  const buildSection = (title, medsArray) => {
    if (medsArray.length === 0) return "";
    return `<div class="mb-4"><h3 class="text-base font-bold text-gray-500 uppercase tracking-wider pb-2 mb-3">${title}</h3><div class="space-y-2">${medsArray.join(
      ""
    )}</div></div>`;
  };
  const finalHtml =
    buildSection("☀️ Morning", morningMeds) +
    buildSection("🕛 Noon", noonMeds) +
    buildSection("🌙 Night", nightMeds);
  todaysMedsList.innerHTML =
    finalHtml.trim() === ""
      ? '<p class="loading-placeholder">No medication scheduled for today.</p>'
      : finalHtml;
}

function renderFullPrescriptions(prescriptions) {
  if (prescriptions.length === 0) {
    prescriptionsList.innerHTML =
      '<p class="loading-placeholder">No active prescriptions found.</p>';
    return;
  }
  prescriptionsList.innerHTML = `<div class="space-y-4">${prescriptions
    .map((pres) => createPrescriptionCard(pres))
    .join("")}</div>`;
}

function createPrescriptionCard(prescription) {
  const medicinesHtml = prescription.medicines
    .map((med, index) => {
      const doses = [];
      if (med.dose.morning) doses.push("M");
      if (med.dose.noon) doses.push("N");
      if (med.dose.night) doses.push("E");

      let stockHtml = "";
      if (med.stockCount > 0) {
        const stockLevelClass =
          med.remainingCount <= 5 ? "text-red-600 font-bold" : "text-blue-600";
        stockHtml = `<div class="text-sm font-semibold ${stockLevelClass}">Stock: ${med.remainingCount} / ${med.stockCount}</div>`;
      } else {
        stockHtml = `<div class="mt-2 flex items-center gap-2"><input type="number" placeholder="Pills bought?" min="1" class="stock-input w-32 p-2 border rounded-md text-sm" data-index="${index}"><button class="save-stock-btn btn btn-primary py-2 px-3 text-xs" data-index="${index}">Save</button></div>`;
      }

      return `<li class="p-3 bg-gray-50 rounded-lg border flex justify-between items-center">
                    <div>
                        <strong class="text-base">${
                          med.name
                        }</strong> <span class="text-sm text-gray-500">(${
        med.totalDays
      } days)</span>
                        <div class="text-sm text-gray-500">Dose Times: ${doses.join(
                          ", "
                        )}</div>
                    </div>
                    ${stockHtml}
                </li>`;
    })
    .join("");

  return `
        <div class="p-4 border rounded-lg prescription-card" data-id="${prescription.id}">
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-bold text-gray-700">From Dr. ${prescription.doctorName}</h3>
                <span class="text-sm text-gray-500">Prescribed: ${prescription.startDate}</span>
            </div>
            <ul class="space-y-3">${medicinesHtml}</ul>
        </div>
    `;
}

async function loadMyAppointments(patientId) {
  try {
    const q = query(
      collection(db, "appointments"),
      where("patientId", "==", patientId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      appointmentsList.innerHTML =
        '<p class="loading-placeholder">No appointments booked.</p>';
      return;
    }
    appointmentsList.innerHTML = querySnapshot.docs
      .map((doc) => {
        const appointment = doc.data();
        const statusClass = `status-${appointment.status}`;
        return `
                <div class="appointment-item">
                    <div class="flex-1">
                        <p class="font-semibold text-gray-800">${
                          appointment.doctorName
                        }</p>
                        <p class="text-sm text-gray-600">${new Date(
                          appointment.slotDateTime
                        ).toLocaleString()}</p>
                    </div>
                    <span class="status-badge ${statusClass}">${
          appointment.status
        }</span>
                </div>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading appointments:", error);
    appointmentsList.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load appointments.</p>';
  }
}

async function loadPatientNotifications(patientId) {
  try {
    const q = query(
      collection(db, "notifications"),
      where("targetUserId", "==", patientId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      notificationsList.innerHTML =
        '<p class="loading-placeholder">You have no notifications.</p>';
      return;
    }
    notificationsList.innerHTML = querySnapshot.docs
      .map((doc) => {
        const notification = doc.data();
        let icon, iconClass;
        switch (notification.type) {
          case "low_stock":
            icon = "fa-pills";
            iconClass = "text-red-500";
            break;
          case "pharmacy_offer":
            icon = "fa-tags";
            iconClass = "text-green-500";
            break;
          default:
            icon = "fa-bell";
            iconClass = "text-blue-500";
        }
        return `
                <div class="notification-item">
                    <i class="icon fa-solid ${icon} ${iconClass}"></i>
                    <p class="message flex-1">${notification.message}</p>
                    <span class="timestamp">${notification.createdAt
                      ?.toDate()
                      .toLocaleDateString()}</span>
                </div>`;
      })
      .join("");
  } catch (error) {
    console.error("Error loading notifications:", error);
    notificationsList.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load notifications.</p>';
  }
}

// --- EVENT HANDLERS & DATA MODIFICATION ---
document.addEventListener("click", async (e) => {
  const doseCheckbox = e.target.closest(".take-dose-cb");
  const saveStockBtn = e.target.closest(".save-stock-btn");

  if (doseCheckbox && doseCheckbox.checked) {
    doseCheckbox.disabled = true;
    const { prescriptionId, medicineIndex, medicineName, doseTime } =
      doseCheckbox.dataset;
    await handleDoseTaken(
      prescriptionId,
      parseInt(medicineIndex),
      medicineName,
      doseTime
    );
  } else if (saveStockBtn) {
    saveStockBtn.disabled = true;
    saveStockBtn.textContent = "...";
    const card = saveStockBtn.closest(".prescription-card");
    const prescriptionId = card.dataset.id;
    const medicineIndex = saveStockBtn.dataset.index;
    const input = card.querySelector(
      `input.stock-input[data-index='${medicineIndex}']`
    );
    const stockValue = parseInt(input.value, 10);
    if (stockValue > 0) {
      await saveStockCount(prescriptionId, medicineIndex, stockValue);
    } else {
      alert("Please enter a valid stock number.");
      saveStockBtn.disabled = false;
      saveStockBtn.textContent = "Save";
    }
  }
});

async function handleDoseTaken(prescriptionId, medIndex, medName, doseTime) {
  const prescription = allPrescriptions.find((p) => p.id === prescriptionId);
  if (!prescription) return;

  const newRemainingCount = prescription.medicines[medIndex].remainingCount - 1;
  const batch = writeBatch(db);

  batch.set(doc(collection(db, "medicationLog")), {
    patientId: currentUserId,
    prescriptionId,
    medicineName: medName,
    doseTime,
    dateTaken: new Date().toISOString().split("T")[0],
    timestamp: new Date(),
  });

  const updatedMedicines = [...prescription.medicines];
  updatedMedicines[medIndex].remainingCount = newRemainingCount;
  batch.update(doc(db, "prescriptions", prescriptionId), {
    medicines: updatedMedicines,
  });

  try {
    await batch.commit();

    // When stock hits 5, create notifications for BOTH the patient and the pharmacy.
    if (newRemainingCount === 5) {
      await createPatientNotification(
        "low_stock",
        `Your stock for ${medName} is running low. Contact your pharmacy.`
      );
      await createPharmacyAlert(medName); // <-- THE FIX
    }

    await loadAllPatientData(currentUserId);
  } catch (error) {
    console.error("Failed to log dose: ", error);
  }
}

async function saveStockCount(prescriptionId, medicineIndex, stockValue) {
  try {
    const presDocRef = doc(db, "prescriptions", prescriptionId);
    const presDoc = await getDoc(presDocRef);
    if (!presDoc.exists()) throw new Error("Prescription not found");

    const updatedMedicines = [...presDoc.data().medicines];
    updatedMedicines[medicineIndex].stockCount = stockValue;
    updatedMedicines[medicineIndex].remainingCount = stockValue;

    await updateDoc(presDocRef, { medicines: updatedMedicines });
    await loadAllPatientData(currentUserId);
  } catch (error) {
    console.error("Error updating stock count: ", error);
  }
}

// --- NOTIFICATION CREATION FUNCTIONS ---
async function createPatientNotification(type, message) {
  try {
    await addDoc(collection(db, "notifications"), {
      type,
      message,
      targetUserId: currentUserId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating patient notification: ", error);
  }
}

// NEW FUNCTION FOR PHARMACY ALERTS
async function createPharmacyAlert(medicineName) {
  try {
    await addDoc(collection(db, "notifications"), {
      type: "low_stock",
      targetRole: "pharmacy", // Correctly targets all pharmacies
      isRead: false,
      createdAt: serverTimestamp(),
      patientId: currentUserId,
      patientName: currentUserName,
      medicineName: medicineName,
      message: `Patient ${currentUserName} is running low on ${medicineName}.`,
    });
    console.log("Pharmacy low stock alert created successfully.");
  } catch (error) {
    console.error("Error creating pharmacy alert: ", error);
  }
}
