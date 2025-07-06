import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const doctorSelect = document.getElementById('doctor-select');
const calendarContainer = document.getElementById('calendar-container');
const calendarGrid = document.getElementById('calendar-grid');
const feedbackMessage = document.getElementById('feedback-message');
const logoutButton = document.getElementById('logout-button');

let currentPatientId;
let currentPatientName;

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'patient') {
            currentPatientId = user.uid;
            currentPatientName = userDoc.data().name;
            loadDoctors();
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

// --- LOAD DOCTORS INTO DROPDOWN ---
async function loadDoctors() {
    try {
        const q = query(collection(db, "users"), where("role", "==", "doctor"));
        const querySnapshot = await getDocs(q);
        
        doctorSelect.innerHTML = '<option value="">-- Select a Doctor --</option>';
        querySnapshot.forEach((doc) => {
            const doctor = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `Dr. ${doctor.name}`;
            doctorSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading doctors: ", error);
    }
}

// --- EVENT LISTENER FOR DOCTOR SELECTION ---
doctorSelect.addEventListener('change', async (e) => {
    const doctorId = e.target.value;
    if (doctorId) {
        calendarContainer.classList.remove('hidden');
        calendarGrid.innerHTML = '<p class="col-span-full text-center">Fetching availability...</p>';
        generateCalendar(doctorId);
    } else {
        calendarContainer.classList.add('hidden');
        calendarGrid.innerHTML = '';
    }
});

// --- GENERATE CALENDAR FOR THE NEXT 7 DAYS ---
async function generateCalendar(doctorId) {
    try {
        const docRef = doc(db, "users", doctorId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists() || !docSnap.data().availability) {
            calendarGrid.innerHTML = '<p class="col-span-full text-center text-red-500">This doctor has not set their availability.</p>';
            return;
        }
        
        const availability = docSnap.data().availability;
        calendarGrid.innerHTML = ''; // Clear the grid

        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            
            const dayName = daysOfWeek[date.getDay()];
            const daySlots = availability[dayName] || []; // Get the time slots for this day of the week

            const dayColumn = document.createElement('div');
            dayColumn.className = 'p-3 bg-gray-50 rounded-lg shadow-sm';
            
            let dayHtml = `<h3 class="font-bold text-center text-gray-700 border-b pb-2 mb-3">
                ${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </h3><div class="space-y-2">`;

            if (daySlots.length > 0) {
                daySlots.forEach(time => {
                    const slotDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...time.split(':'));
                    dayHtml += `
                        <button class="w-full text-center p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 book-slot-btn" 
                                data-doctor-id="${doctorId}"
                                data-doctor-name="${docSnap.data().name}"
                                data-slot-datetime="${slotDateTime.toISOString()}">
                            ${time}
                        </button>
                    `;
                });
            } else {
                dayHtml += '<p class="text-center text-xs text-gray-400">No slots</p>';
            }
            
            dayHtml += '</div>';
            dayColumn.innerHTML = dayHtml;
            calendarGrid.appendChild(dayColumn);
        }

    } catch (error) {
        console.error("Error generating calendar: ", error);
        calendarGrid.innerHTML = '<p class="col-span-full text-center text-red-500">Could not fetch schedule.</p>';
    }
}

// --- EVENT LISTENER FOR BOOKING A SLOT ---
calendarGrid.addEventListener('click', async (e) => {
    if (e.target.classList.contains('book-slot-btn')) {
        const button = e.target;
        const { doctorId, doctorName, slotDatetime } = button.dataset;

        const confirmation = confirm(`Request appointment with Dr. ${doctorName} on ${new Date(slotDatetime).toLocaleString()}?`);
        
        if (confirmation) {
            feedbackMessage.textContent = 'Requesting appointment...';
            feedbackMessage.className = 'text-center mt-4 font-semibold text-blue-600';
            try {
                await addDoc(collection(db, "appointments"), {
                    patientId: currentPatientId,
                    patientName: currentPatientName,
                    doctorId: doctorId,
                    doctorName: `Dr. ${doctorName}`,
                    slotDateTime: slotDatetime, // Stored as ISO String
                    status: "pending", // Can be 'pending', 'confirmed', 'rejected'
                    createdAt: serverTimestamp()
                });
                feedbackMessage.textContent = 'Appointment requested successfully! The doctor will confirm shortly.';
                feedbackMessage.className = 'text-center mt-4 font-semibold text-green-600';
                button.disabled = true; // Disable the button after booking
                button.textContent = 'Requested';
                button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                button.classList.add('bg-gray-400', 'cursor-not-allowed');
            } catch (error) {
                console.error("Error booking appointment: ", error);
                feedbackMessage.textContent = 'Failed to book appointment. Please try again.';
                feedbackMessage.className = 'text-center mt-4 font-semibold text-red-500';
            }
        }
    }
});