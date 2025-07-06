import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const notificationsList = document.getElementById('notifications-list');
const logoutButton = document.getElementById('logout-button');

// --- AUTHENTICATION & DATA LOADING ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().role === 'pharmacy') {
            loadNotifications();
        } else {
            // Not a pharmacy, redirect
            window.location.href = '/login.html';
        }
    } else {
        // User not logged in
        window.location.href = '/login.html';
    }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = '/login.html';
    });
});

// --- LOAD NOTIFICATIONS ---
async function loadNotifications() {
    notificationsList.innerHTML = '<p class="text-center text-gray-500">Loading notifications...</p>';

    try {
        const q = query(
            collection(db, "notifications"), 
            where("targetRole", "==", "pharmacy"), 
            where("isRead", "==", false),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            notificationsList.innerHTML = '<p class="text-center text-gray-500">No new notifications.</p>';
            return;
        }

        notificationsList.innerHTML = ''; // Clear loading message
        querySnapshot.forEach(doc => {
            const notification = doc.data();
            const notificationCard = createNotificationCard(notification);
            notificationsList.appendChild(notificationCard);
        });

    } catch (error) {
        console.error("Error loading notifications: ", error);
        notificationsList.innerHTML = '<p class="text-center text-red-500">Could not load notifications.</p>';
    }
}

function createNotificationCard(notification) {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-lg shadow flex justify-between items-center';

    const timestamp = notification.createdAt?.toDate().toLocaleString() || 'Just now';

    card.innerHTML = `
        <div>
            <p class="font-semibold text-gray-800">${notification.message}</p>
            <p class="text-sm text-gray-500">Received: ${timestamp}</p>
        </div>
        <button class="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold py-1 px-3 rounded">
            Mark as Read
        </button>
    `;
    return card;
}