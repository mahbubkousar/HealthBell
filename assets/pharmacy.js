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

const notificationsList = document.getElementById("notifications-list");
const logoutButton = document.getElementById("logout-button");
let pharmacyName; // Store pharmacy name for notifications

// --- AUTHENTICATION & DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists() && userDoc.data().role === "pharmacy") {
      pharmacyName = userDoc.data().name; // Get pharmacy name
      loadNotifications();
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

// --- LOAD NOTIFICATIONS (MODIFIED) ---
async function loadNotifications() {
  notificationsList.innerHTML =
    '<p class="text-center text-gray-500">Loading notifications...</p>';
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
        '<p class="text-center text-gray-500">No new notifications.</p>';
      return;
    }

    notificationsList.innerHTML = "";
    querySnapshot.forEach((doc) => {
      // Pass the document ID to the creation function
      const notificationCard = createNotificationCard(doc.id, doc.data());
      notificationsList.appendChild(notificationCard);
    });
  } catch (error) {
    console.error("Error loading notifications: ", error);
  }
}

// --- CREATE NOTIFICATION CARD (MODIFIED) ---
function createNotificationCard(docId, notification) {
  const card = document.createElement("div");
  card.className =
    "bg-white p-4 rounded-lg shadow flex justify-between items-center";
  const timestamp =
    notification.createdAt?.toDate().toLocaleString() || "Just now";

  card.innerHTML = `
        <div>
            <p class="font-semibold text-gray-800">${notification.message}</p>
            <p class="text-sm text-gray-500">Received: ${timestamp}</p>
        </div>
        <div class="flex gap-2">
            <button class="send-offer-btn bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-1 px-3 rounded"
                    data-doc-id="${docId}"
                    data-patient-id="${notification.patientId}"
                    data-medicine-name="${notification.medicineName}">
                Send Offer
            </button>
            <button class="mark-read-btn bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold py-1 px-3 rounded"
                    data-doc-id="${docId}">
                Dismiss
            </button>
        </div>
    `;
  return card;
}

// --- EVENT LISTENER FOR BUTTONS ---
notificationsList.addEventListener("click", async (e) => {
  const button = e.target;
  const docId = button.dataset.docId;
  if (!docId) return;

  if (button.classList.contains("send-offer-btn")) {
    const { patientId, medicineName } = button.dataset;
    const offerMessage = prompt(
      `Enter your offer for ${medicineName} (e.g., '20% off your next refill!'):`
    );

    if (offerMessage) {
      button.disabled = true;
      button.textContent = "Sending...";
      await sendOfferToPatient(patientId, medicineName, offerMessage);
      await markNotificationAsRead(docId);
      loadNotifications(); // Refresh the list
    }
  } else if (button.classList.contains("mark-read-btn")) {
    button.disabled = true;
    await markNotificationAsRead(docId);
    loadNotifications(); // Refresh the list
  }
});

// --- NEW FUNCTION TO SEND OFFER ---
async function sendOfferToPatient(patientId, medicineName, offerMessage) {
  try {
    await addDoc(collection(db, "notifications"), {
      type: "pharmacy_offer",
      targetUserId: patientId, // Target a specific patient
      message: `Offer from ${pharmacyName} for ${medicineName}: ${offerMessage}`,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    alert("Offer sent successfully!");
  } catch (error) {
    console.error("Error sending offer: ", error);
    alert("Failed to send offer.");
  }
}

// --- NEW FUNCTION TO MARK AS READ ---
async function markNotificationAsRead(docId) {
  try {
    const docRef = doc(db, "notifications", docId);
    await updateDoc(docRef, { isRead: true });
  } catch (error) {
    console.error("Error marking notification as read: ", error);
  }
}
