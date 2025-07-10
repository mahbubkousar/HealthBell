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
  orderBy,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DOM Element References ---
const loadingOverlay = document.getElementById("loading-overlay");
const notificationsList = document.getElementById("notifications-list");
const logoutButton = document.getElementById("logout-button");

let pharmacyName;

// --- AUTHENTICATION & MASTER DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().role === "pharmacy") {
      pharmacyName = userDoc.data().name;
      await loadAllPharmacyData();
    } else {
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

async function loadAllPharmacyData() {
  loadingOverlay.style.display = "flex";
  try {
    await loadNotifications();
  } catch (error) {
    console.error("Error loading pharmacy data:", error);
  } finally {
    loadingOverlay.style.display = "none";
  }
}

// --- LOGOUT ---
logoutButton.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "/login.html"));
});

// --- LOAD & RENDER NOTIFICATIONS (REDESIGNED) ---
async function loadNotifications() {
  try {
    const q = query(
      collection(db, "notifications"),
      where("targetRole", "==", "pharmacy"),
      where("isRead", "==", false),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      notificationsList.innerHTML =
        '<p class="loading-placeholder">No new alerts.</p>';
      return;
    }

    notificationsList.innerHTML = querySnapshot.docs
      .map((doc) => {
        const notification = doc.data();
        const timestamp =
          notification.createdAt?.toDate().toLocaleDateString() || "Just now";
        return `
                <div class="p-4 border rounded-lg bg-yellow-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <p class="font-semibold text-gray-800">${notification.message}</p>
                        <p class="text-sm text-gray-500">Received: ${timestamp}</p>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button class="send-offer-btn btn btn-primary text-xs py-1 px-3"
                                data-doc-id="${doc.id}"
                                data-patient-id="${notification.patientId}"
                                data-medicine-name="${notification.medicineName}">
                            <i class="fa-solid fa-paper-plane mr-1"></i> Send Offer
                        </button>
                        <button class="mark-read-btn btn bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-1 px-3"
                                data-doc-id="${doc.id}">
                            Dismiss
                        </button>
                    </div>
                </div>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading notifications: ", error);
    notificationsList.innerHTML =
      '<p class="loading-placeholder text-red-500">Could not load alerts.</p>';
  }
}

// --- EVENT LISTENERS & ACTIONS ---
notificationsList.addEventListener("click", async (e) => {
  const button = e.target.closest(".send-offer-btn, .mark-read-btn");
  if (!button) return;

  button.disabled = true;
  const docId = button.dataset.docId;

  if (button.classList.contains("send-offer-btn")) {
    const { patientId, medicineName } = button.dataset;
    const offerMessage = prompt(
      `Enter your offer for ${medicineName} for patient (e.g., '15% off your next refill!'):`
    );

    if (offerMessage && offerMessage.trim() !== "") {
      await sendOfferToPatient(patientId, medicineName, offerMessage);
      await markNotificationAsRead(docId);
      await loadAllPharmacyData(); // Refresh the list
    } else {
      button.disabled = false; // Re-enable if prompt is cancelled
    }
  } else if (button.classList.contains("mark-read-btn")) {
    await markNotificationAsRead(docId);
    await loadAllPharmacyData(); // Refresh the list
  }
});

async function sendOfferToPatient(patientId, medicineName, offerMessage) {
  try {
    await addDoc(collection(db, "notifications"), {
      type: "pharmacy_offer",
      targetUserId: patientId,
      message: `Offer from ${pharmacyName} for ${medicineName}: ${offerMessage}`,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    // We can remove the alert for a smoother experience
  } catch (error) {
    console.error("Error sending offer: ", error);
    alert("Failed to send offer."); // Keep alert for failures
  }
}

async function markNotificationAsRead(docId) {
  try {
    await updateDoc(doc(db, "notifications", docId), { isRead: true });
  } catch (error) {
    console.error("Error marking notification as read: ", error);
  }
}
