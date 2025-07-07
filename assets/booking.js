import { auth, db } from "../firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const doctorSelect = document.getElementById("doctor-select");
const calendarContainer = document.getElementById("calendar-container");
const calendarGrid = document.getElementById("calendar-grid");
const feedbackMessage = document.getElementById("feedback-message");
const logoutButton = document.getElementById("logout-button");

let currentPatientId;
let currentPatientName;

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists() && userDoc.data().role === "patient") {
      currentPatientId = user.uid;
      currentPatientName = userDoc.data().name;
      loadDoctors();
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

// --- LOAD DOCTORS INTO DROPDOWN ---
async function loadDoctors() {
  try {
    const q = query(collection(db, "users"), where("role", "==", "doctor"));
    const querySnapshot = await getDocs(q);

    doctorSelect.innerHTML = '<option value="">-- Select a Doctor --</option>';
    querySnapshot.forEach((doc) => {
      const doctor = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `Dr. ${doctor.name}`;
      doctorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading doctors: ", error);
  }
}

// --- EVENT LISTENER FOR DOCTOR SELECTION ---
doctorSelect.addEventListener("change", async (e) => {
  const doctorId = e.target.value;
  if (doctorId) {
    calendarContainer.classList.remove("hidden");
    calendarGrid.innerHTML =
      '<p class="col-span-full text-center">Fetching availability...</p>';
    generateCalendar(doctorId);
  } else {
    calendarContainer.classList.add("hidden");
    calendarGrid.innerHTML = "";
  }
});

// --- GENERATE CALENDAR (HEAVILY MODIFIED TO PREVENT DOUBLE BOOKING) ---
async function generateCalendar(doctorId) {
  try {
    // Step 1: Get doctor's availability template and existing appointments in parallel
    const doctorDocRef = doc(db, "users", doctorId);
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId),
      where("status", "in", ["pending", "confirmed"])
    );

    const [doctorDoc, appointmentsSnapshot] = await Promise.all([
      getDoc(doctorDocRef),
      getDocs(appointmentsQuery),
    ]);

    if (!doctorDoc.exists() || !doctorDoc.data().availability) {
      calendarGrid.innerHTML =
        '<p class="col-span-full text-center text-red-500">This doctor has not set their availability.</p>';
      return;
    }

    const availability = doctorDoc.data().availability;

    // Step 2: Create a Set of already booked slots for quick lookups
    const bookedSlots = new Set();
    appointmentsSnapshot.forEach((doc) => {
      bookedSlots.add(doc.data().slotDateTime);
    });

    // Step 3: Generate the calendar grid
    calendarGrid.innerHTML = "";
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      const dayName = daysOfWeek[date.getDay()];
      const daySlots = availability[dayName] || [];

      const dayColumn = document.createElement("div");
      dayColumn.className = "p-3 bg-gray-50 rounded-lg shadow-sm";

      let dayHtml = `<h3 class="font-bold text-center text-gray-700 border-b pb-2 mb-3">
                ${date.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
            </h3><div class="space-y-2">`;

      if (daySlots.length > 0) {
        daySlots.forEach((time) => {
          const slotDateTime = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            ...time.split(":")
          );
          const isoString = slotDateTime.toISOString();

          // Step 4: Check if the slot is booked and render button accordingly
          if (bookedSlots.has(isoString)) {
            dayHtml += `
                            <button class="w-full text-center p-2 rounded-md bg-gray-300 text-gray-500 cursor-not-allowed" disabled>
                                Booked
                            </button>
                        `;
          } else {
            dayHtml += `
                            <button class="w-full text-center p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 book-slot-btn" 
                                    data-doctor-id="${doctorId}"
                                    data-doctor-name="${doctorDoc.data().name}"
                                    data-slot-datetime="${isoString}">
                                ${time}
                            </button>
                        `;
          }
        });
      } else {
        dayHtml += '<p class="text-center text-xs text-gray-400">No slots</p>';
      }

      dayHtml += "</div>";
      dayColumn.innerHTML = dayHtml;
      calendarGrid.appendChild(dayColumn);
    }
  } catch (error) {
    console.error("Error generating calendar: ", error);
    calendarGrid.innerHTML =
      '<p class="col-span-full text-center text-red-500">Could not fetch schedule. A required index might be missing.</p>';
  }
}

// --- EVENT LISTENER FOR BOOKING A SLOT ---
calendarGrid.addEventListener("click", async (e) => {
  if (e.target.classList.contains("book-slot-btn")) {
    const button = e.target;
    const { doctorId, doctorName, slotDatetime } = button.dataset;

    const confirmation = confirm(
      `Request appointment with Dr. ${doctorName} on ${new Date(
        slotDatetime
      ).toLocaleString()}?`
    );

    if (confirmation) {
      feedbackMessage.textContent = "Requesting appointment...";
      feedbackMessage.className =
        "text-center mt-4 font-semibold text-blue-600";
      try {
        await addDoc(collection(db, "appointments"), {
          patientId: currentPatientId,
          patientName: currentPatientName,
          doctorId: doctorId,
          doctorName: `Dr. ${doctorName}`,
          slotDateTime: slotDatetime,
          status: "pending",
          createdAt: serverTimestamp(),
        });
        feedbackMessage.textContent =
          "Appointment requested successfully! The doctor will confirm shortly.";
        feedbackMessage.className =
          "text-center mt-4 font-semibold text-green-600";
        button.disabled = true;
        button.textContent = "Requested";
        button.classList.remove("bg-blue-500", "hover:bg-blue-600");
        button.classList.add("bg-gray-400", "cursor-not-allowed");
      } catch (error) {
        console.error("Error booking appointment: ", error);
        feedbackMessage.textContent =
          "Failed to book appointment. Please try again.";
        feedbackMessage.className =
          "text-center mt-4 font-semibold text-red-500";
      }
    }
  }
});
