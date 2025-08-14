// assets/symptom-analyzer.js - AI Symptom Analyzer with Gemini API
import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const symptomInput = document.getElementById("symptom-input");
const sendBtn = document.getElementById("send-btn");
const clearChatBtn = document.getElementById("clear-chat");
const suggestionBtns = document.querySelectorAll(".suggestion-btn");
const emergencyBtn = document.getElementById("emergency-btn");
const medicationCheckBtn = document.getElementById("medication-check");
const healthTipsBtn = document.getElementById("health-tips");
const emergencyModal = document.getElementById("emergency-modal");
const modalClose = document.querySelector(".modal-close");
const conversationHistory = document.getElementById("conversation-history");
const logoutButton = document.getElementById("logout-button");

// Global Variables
let currentUser = null;
let currentUserData = null;
let conversationId = null;
let isProcessing = false;

// Gemini API Configuration
const GEMINI_API_KEY = "AIzaSyDyKbBeFpH2-lKdxjqO6PNrXJUFTwGb-Gk"; // You should replace this with your actual API key
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

// System prompt for medical symptom analysis
const SYSTEM_PROMPT = `You are HealthBell AI, a medical symptom analyzer assistant. You provide helpful, accurate, and empathetic responses about health symptoms while following these guidelines:

1. ALWAYS remind users that you are not a replacement for professional medical advice
2. For serious symptoms, ALWAYS recommend seeking immediate medical attention
3. Ask clarifying questions to better understand symptoms
4. Provide general information about possible causes and when to see a doctor
5. Be empathetic and reassuring while being medically responsible
6. Do not provide specific diagnoses or prescribe treatments
7. Focus on symptom assessment, general health information, and when to seek medical care
8. If symptoms sound emergency-related, emphasize seeking immediate medical attention

Keep responses concise but informative, and always maintain a caring, professional tone.`;

// Initialize the application
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        currentUserData = { id: user.uid, ...userDoc.data() };
        
        // Check if user is a patient
        if (currentUserData.role !== "patient") {
          showNotification("This feature is only available for patients.", "error");
          window.location.href = "/patient-dashboard.html";
          return;
        }
        
        initializeAnalyzer();
      } else {
        window.location.href = "/login.html";
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      window.location.href = "/login.html";
    }
  } else {
    window.location.href = "/login.html";
  }
});

// Initialize the analyzer
async function initializeAnalyzer() {
  try {
    setupEventListeners();
    loadConversationHistory();
    startNewConversation();
    hideLoading();
  } catch (error) {
    console.error("Error initializing analyzer:", error);
    showNotification("Failed to initialize symptom analyzer.", "error");
    hideLoading();
  }
}

// Setup event listeners
function setupEventListeners() {
  // Chat form submission
  chatForm.addEventListener("submit", handleSymptomSubmit);
  
  // Clear chat
  clearChatBtn.addEventListener("click", clearChat);
  
  // Suggestion buttons
  suggestionBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const suggestionText = e.target.dataset.text;
      symptomInput.value = suggestionText;
      symptomInput.focus();
    });
  });
  
  // Quick action buttons
  emergencyBtn.addEventListener("click", showEmergencyModal);
  medicationCheckBtn.addEventListener("click", () => {
    addUserMessage("I want to check for medication interactions.");
    processSymptomAnalysis("I want to check for medication interactions with my current medications. Can you guide me on what information I should provide?");
  });
  
  healthTipsBtn.addEventListener("click", () => {
    addUserMessage("Can you give me some general health tips?");
    processSymptomAnalysis("Can you provide some general health and wellness tips for maintaining good health?");
  });
  
  // Emergency modal
  modalClose.addEventListener("click", hideEmergencyModal);
  emergencyModal.addEventListener("click", (e) => {
    if (e.target === emergencyModal) hideEmergencyModal();
  });
  
  // ESC key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideEmergencyModal();
  });
  
  // Auto-resize textarea
  symptomInput.addEventListener("input", autoResizeTextarea);
  
  // Logout button
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      signOut(auth).then(() => {
        window.location.href = "/login.html";
      }).catch((error) => {
        console.error("Error signing out:", error);
        showNotification("Failed to logout. Please try again.", "error");
      });
    });
  }
}

// Handle symptom analysis submission
async function handleSymptomSubmit(e) {
  e.preventDefault();
  
  const symptomText = symptomInput.value.trim();
  if (!symptomText || isProcessing) return;
  
  // Add user message to chat
  addUserMessage(symptomText);
  
  // Clear input and process
  symptomInput.value = "";
  await processSymptomAnalysis(symptomText);
}

// Process symptom analysis with Gemini AI
async function processSymptomAnalysis(symptomText) {
  if (isProcessing) return;
  
  isProcessing = true;
  sendBtn.disabled = true;
  sendBtn.classList.add("loading");
  
  // Show typing indicator
  showTypingIndicator();
  
  try {
    const response = await callGeminiAPI(symptomText);
    
    // Remove typing indicator
    removeTypingIndicator();
    
    if (response && response.text) {
      addAIMessage(response.text);
      
      // Save conversation to Firebase
      await saveConversationMessage(symptomText, response.text);
    } else {
      throw new Error("Invalid response from AI");
    }
    
  } catch (error) {
    console.error("Error processing symptom analysis:", error);
    removeTypingIndicator();
    
    const errorMessage = "I'm sorry, I'm experiencing some technical difficulties right now. Please try again in a moment, or if you have urgent symptoms, please contact your healthcare provider or emergency services immediately.";
    addAIMessage(errorMessage);
    
    showNotification("Failed to analyze symptoms. Please try again.", "error");
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    sendBtn.classList.remove("loading");
  }
}

// Call Gemini API
async function callGeminiAPI(userMessage) {
  try {
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nUser Query: ${userMessage}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      return {
        text: data.candidates[0].content.parts[0].text
      };
    } else {
      throw new Error("No response from AI model");
    }
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

// Add user message to chat
function addUserMessage(message) {
  const messageEl = createMessageElement(message, "user");
  chatMessages.appendChild(messageEl);
  scrollToBottom();
}

// Add AI message to chat
function addAIMessage(message) {
  const messageEl = createMessageElement(message, "ai");
  chatMessages.appendChild(messageEl);
  scrollToBottom();
}

// Create message element
function createMessageElement(message, type) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}-message`;
  
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.innerHTML = type === "ai" ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
  
  const content = document.createElement("div");
  content.className = "message-content";
  
  const text = document.createElement("div");
  text.className = "message-text";
  text.innerHTML = formatMessage(message);
  
  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  content.appendChild(text);
  content.appendChild(time);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  
  return messageDiv;
}

// Format message text (convert line breaks, etc.)
function formatMessage(message) {
  return message
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Show typing indicator
function showTypingIndicator() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "message ai-message typing-indicator";
  typingDiv.id = "typing-indicator";
  
  typingDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
      <div class="message-text">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  
  chatMessages.appendChild(typingDiv);
  scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Scroll chat to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Auto-resize textarea
function autoResizeTextarea() {
  symptomInput.style.height = "auto";
  symptomInput.style.height = Math.min(symptomInput.scrollHeight, 120) + "px";
}

// Clear chat
function clearChat() {
  // Keep only the initial AI message
  const initialMessage = chatMessages.querySelector(".ai-message");
  chatMessages.innerHTML = "";
  if (initialMessage) {
    chatMessages.appendChild(initialMessage);
  }
  
  // Start new conversation
  startNewConversation();
  showNotification("Conversation cleared.", "info");
}

// Start new conversation
function startNewConversation() {
  conversationId = Date.now().toString();
}

// Save conversation message to Firebase
async function saveConversationMessage(userMessage, aiResponse) {
  try {
    await addDoc(collection(db, "symptomConversations"), {
      userId: currentUser.uid,
      conversationId: conversationId,
      userMessage: userMessage,
      aiResponse: aiResponse,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving conversation:", error);
  }
}

// Load conversation history
async function loadConversationHistory() {
  try {
    const q = query(
      collection(db, "symptomConversations"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    
    const querySnapshot = await getDocs(q);
    const conversations = new Map();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!conversations.has(data.conversationId)) {
        conversations.set(data.conversationId, {
          id: data.conversationId,
          preview: data.userMessage.substring(0, 50) + "...",
          time: data.createdAt?.toDate() || new Date(),
          messages: []
        });
      }
    });
    
    if (conversations.size > 0) {
      renderConversationHistory(Array.from(conversations.values()));
    }
    
  } catch (error) {
    console.error("Error loading conversation history:", error);
  }
}

// Render conversation history
function renderConversationHistory(conversations) {
  const historyContainer = conversationHistory;
  
  if (conversations.length === 0) {
    historyContainer.innerHTML = '<p class="no-history">No previous conversations</p>';
    return;
  }
  
  historyContainer.innerHTML = conversations.map(conv => `
    <div class="history-item" data-conversation-id="${conv.id}">
      <div class="history-preview">${conv.preview}</div>
      <div class="history-time">${getTimeAgo(conv.time)}</div>
    </div>
  `).join("");
  
  // Add click listeners to history items
  historyContainer.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", () => {
      const convId = item.dataset.conversationId;
      loadConversation(convId);
    });
  });
}

// Load specific conversation
async function loadConversation(conversationId) {
  try {
    showNotification("Loading conversation...", "info");
    
    const q = query(
      collection(db, "symptomConversations"),
      where("userId", "==", currentUser.uid),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    
    const querySnapshot = await getDocs(q);
    
    // Clear current chat
    clearChat();
    
    // Load messages
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      addUserMessage(data.userMessage);
      addAIMessage(data.aiResponse);
    });
    
    // Set current conversation ID
    this.conversationId = conversationId;
    
  } catch (error) {
    console.error("Error loading conversation:", error);
    showNotification("Failed to load conversation.", "error");
  }
}

// Show emergency modal
function showEmergencyModal() {
  emergencyModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

// Hide emergency modal
function hideEmergencyModal() {
  emergencyModal.classList.remove("active");
  document.body.style.overflow = "";
}

// Utility function: Get time ago
function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// Show notification
function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;

  // Add to body
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.style.display = "none";
}

// Add notification styles if not already present
if (!document.querySelector("#notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--glass-bg-light);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
    }
    
    .notification-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-text);
      font-weight: 500;
    }
    
    .notification-success i { color: #10b981; }
    .notification-error i { color: #ef4444; }
    .notification-info i { color: var(--color-primary); }
    
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}