import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const scheduleGrid = document.getElementById('schedule-grid');
const scheduleForm = document.getElementById('schedule-form');
const logoutButton = document.getElementById('logout-button');
const successMessage = document.getElementById('success-message');

let currentDoctorId;

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'doctor') {
            currentDoctorId = user.uid;
            generateScheduleGrid();
            loadAvailability(currentDoctorId);
        } else {
            window.location.href = '/login.html';
        }
    } else {
        window.location.href = '/login.html';
    }
});

// --- LOGOUT LOGIC ---
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = '/login.html');
});

// --- GENERATE THE SCHEDULE CHECKBOX GRID ---
function generateScheduleGrid() {
    scheduleGrid.innerHTML = ''; // Clear loading message
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    // Example time slots. You can easily add more.
    const timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']; 

    days.forEach(day => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'p-3 bg-gray-50 rounded-lg';
        
        let dayHtml = `<h3 class="font-bold text-center text-gray-700 border-b pb-2 mb-3">${day}</h3><div class="space-y-2">`;
        
        timeSlots.forEach(time => {
            const checkboxId = `${day}-${time}`;
            dayHtml += `
                <label for="${checkboxId}" class="flex items-center p-2 rounded-md hover:bg-blue-100 cursor-pointer">
                    <input type="checkbox" id="${checkboxId}" name="${checkboxId}" class="form-checkbox h-5 w-5 text-blue-600" data-day="${day}" data-time="${time}">
                    <span class="ml-3 text-gray-800">${time}</span>
                </label>
            `;
        });
        
        dayHtml += '</div>';
        dayColumn.innerHTML = dayHtml;
        scheduleGrid.appendChild(dayColumn);
    });
}

// --- LOAD SAVED AVAILABILITY ---
async function loadAvailability(doctorId) {
    try {
        const docRef = doc(db, "users", doctorId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().availability) {
            const availability = docSnap.data().availability;
            // Loop through the saved availability and check the corresponding boxes
            for (const day in availability) {
                availability[day].forEach(time => {
                    const checkbox = document.getElementById(`${day}-${time}`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error loading availability: ", error);
    }
}

// --- FORM SUBMISSION TO SAVE SCHEDULE ---
scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    successMessage.textContent = 'Saving...';
    
    const allCheckboxes = scheduleForm.querySelectorAll('input[type="checkbox"]');
    const newAvailability = {
        // Initialize with empty arrays for each day
        Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
    };

    // Populate the availability object with checked times
    allCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const day = checkbox.dataset.day;
            const time = checkbox.dataset.time;
            if (newAvailability[day]) {
                newAvailability[day].push(time);
            }
        }
    });

    try {
        const docRef = doc(db, "users", currentDoctorId);
        await updateDoc(docRef, {
            availability: newAvailability
        });
        successMessage.textContent = 'Schedule updated successfully!';
        setTimeout(() => { successMessage.textContent = '' }, 3000);
    } catch (error) {
        console.error("Error updating schedule: ", error);
        successMessage.textContent = 'Failed to save schedule. Please try again.';
        successMessage.classList.add('text-red-500');
    }
});