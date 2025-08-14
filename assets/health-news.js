// assets/health-news.js - Health News Integration with NewsAPI
import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay");
const newsSearch = document.getElementById("news-search");
const clearSearchBtn = document.getElementById("clear-search");
const filterBtns = document.querySelectorAll(".filter-btn");
const refreshBtn = document.getElementById("refresh-news");
const featuredNews = document.getElementById("featured-news");
const newsGrid = document.getElementById("news-grid");
const newsCount = document.getElementById("news-count");
const loadMoreBtn = document.getElementById("load-more");
const noResults = document.getElementById("no-results");
const newsModal = document.getElementById("news-modal");
const newsModalClose = document.querySelector(".news-modal-close");
const newsModalBody = document.getElementById("news-modal-body");
const logoutButton = document.getElementById("logout-button");

// Global Variables
let currentUser = null;
let currentUserData = null;
let allArticles = [];
let filteredArticles = [];
let currentFilter = "all";
let currentPage = 1;
const articlesPerPage = 12;

// NewsAPI Configuration
const NEWS_API_KEY = window.APP_CONFIG.NEWS_API_KEY;
const NEWS_API_URL = "https://newsapi.org/v2/top-headlines";

// Initialize the application
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        currentUserData = { id: user.uid, ...userDoc.data() };
        initializeNewsPage();
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

// Initialize news page
async function initializeNewsPage() {
  try {
    setupEventListeners();
    updateNavigation();
    await loadHealthNews();
    hideLoading();
  } catch (error) {
    console.error("Error initializing news page:", error);
    showNotification("Failed to load news. Please try again.", "error");
    hideLoading();
  }
}

// Update Navigation Based on User Role
function updateNavigation() {
  const dashboardLink = document.getElementById("dashboard-link");
  const appointmentsNav = document.getElementById("appointments-nav");
  const symptomAnalyzerNav = document.getElementById("symptom-analyzer-nav");
  const scheduleNav = document.getElementById("schedule-nav");
  
  // Set dashboard link based on role
  switch (currentUserData.role) {
    case "doctor":
      dashboardLink.href = "/doctor-dashboard.html";
      if (scheduleNav) scheduleNav.style.display = "block";
      break;
    case "pharmacy":
      dashboardLink.href = "/pharmacy-dashboard.html";
      break;
    case "patient":
    default:
      dashboardLink.href = "/patient-dashboard.html";
      if (appointmentsNav) appointmentsNav.style.display = "block";
      if (symptomAnalyzerNav) symptomAnalyzerNav.style.display = "block";
      break;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search functionality
  newsSearch.addEventListener("input", handleSearch);
  clearSearchBtn.addEventListener("click", clearSearch);
  
  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      filterBtns.forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.category;
      filterNews();
    });
  });
  
  // Refresh button
  refreshBtn.addEventListener("click", refreshNews);
  
  // Load more button
  loadMoreBtn.addEventListener("click", loadMoreArticles);
  
  // Modal functionality
  newsModalClose.addEventListener("click", closeNewsModal);
  newsModal.addEventListener("click", (e) => {
    if (e.target === newsModal) closeNewsModal();
  });
  
  // ESC key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNewsModal();
  });
  
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

// Load health news from NewsAPI
async function loadHealthNews() {
  try {
    showLoadingSkeletons();
    
    const apiUrl = `${NEWS_API_URL}?country=us&category=health&pageSize=50&apiKey=${NEWS_API_KEY}`;
    console.log("Fetching news from:", apiUrl);
    
    // Fetch health news from NewsAPI
    const response = await fetch(apiUrl);
    
    console.log("Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(`NewsAPI request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log("API response:", data);
    
    if (data.status === "ok" && data.articles) {
      allArticles = data.articles.filter(article => 
        article.title && 
        article.title !== "[Removed]" &&
        article.description && 
        article.description !== "[Removed]"
      );
      
      console.log("Filtered articles count:", allArticles.length);
      
      filteredArticles = [...allArticles];
      renderNews();
      
      // Save news fetch to Firebase for analytics
      await saveNewsInteraction("news_loaded", { articles_count: allArticles.length });
      
    } else {
      console.error("Invalid response structure:", data);
      throw new Error("Invalid response from NewsAPI");
    }
    
  } catch (error) {
    console.error("Error loading health news:", error);
    showErrorState();
    showNotification("Failed to load news. Please check your internet connection.", "error");
  }
}

// Render news articles
function renderNews() {
  renderFeaturedNews();
  renderAllNews();
  updateNewsStats();
  hideLoadingSkeletons();
}

// Render featured news
function renderFeaturedNews() {
  const featuredArticles = filteredArticles.slice(0, 3);
  
  if (featuredArticles.length === 0) {
    featuredNews.innerHTML = '<div class="no-results"><p>No featured articles available</p></div>';
    return;
  }
  
  featuredNews.innerHTML = featuredArticles.map((article, index) => `
    <div class="featured-news-card" onclick="openNewsModal(${allArticles.indexOf(article)})">
      <img src="${article.urlToImage || 'https://via.placeholder.com/400x200?text=Health+News'}" 
           alt="${article.title}" 
           class="featured-news-image"
           onerror="this.src='https://via.placeholder.com/400x200?text=Health+News'">
      <div class="featured-news-content">
        <div class="featured-badge">
          <i class="fas fa-star"></i>
          Featured
        </div>
        <h3 class="featured-news-title">${article.title}</h3>
        <p class="featured-news-description">${article.description || ''}</p>
        <div class="featured-news-meta">
          <span class="featured-news-source">${article.source.name}</span>
          <span class="featured-news-date">${formatDate(article.publishedAt)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Render all news
function renderAllNews() {
  const startIndex = 3; // Skip featured articles
  const endIndex = Math.min(startIndex + (currentPage * articlesPerPage), filteredArticles.length);
  const articlesToShow = filteredArticles.slice(startIndex, endIndex);
  
  if (currentPage === 1) {
    newsGrid.innerHTML = '';
  }
  
  if (articlesToShow.length === 0 && currentPage === 1) {
    newsGrid.innerHTML = `
      <div class="no-results" style="grid-column: 1 / -1;">
        <div class="no-results-content">
          <i class="fas fa-search"></i>
          <h3>No articles found</h3>
          <p>Try adjusting your search terms or filters</p>
        </div>
      </div>
    `;
    return;
  }
  
  const newsHTML = articlesToShow.map((article, index) => `
    <div class="news-card" onclick="openNewsModal(${allArticles.indexOf(article)})" 
         style="animation-delay: ${(index % articlesPerPage) * 0.1}s">
      <img src="${article.urlToImage || 'https://via.placeholder.com/320x180?text=Health+News'}" 
           alt="${article.title}" 
           class="news-image"
           onerror="this.src='https://via.placeholder.com/320x180?text=Health+News'">
      <div class="news-content">
        <div class="news-category">Health</div>
        <h3 class="news-title">${article.title}</h3>
        <p class="news-description">${article.description || ''}</p>
        <div class="news-meta">
          <span class="news-source">${article.source.name}</span>
          <span class="news-date">
            <i class="fas fa-clock"></i>
            ${formatDate(article.publishedAt)}
          </span>
        </div>
      </div>
    </div>
  `).join('');
  
  if (currentPage === 1) {
    newsGrid.innerHTML = newsHTML;
  } else {
    newsGrid.innerHTML += newsHTML;
  }
  
  // Show/hide load more button
  const hasMore = endIndex < filteredArticles.length;
  loadMoreBtn.style.display = hasMore ? 'block' : 'none';
}

// Handle search
function handleSearch() {
  const searchTerm = newsSearch.value.toLowerCase().trim();
  
  if (searchTerm) {
    clearSearchBtn.style.display = 'block';
    filteredArticles = allArticles.filter(article => 
      article.title.toLowerCase().includes(searchTerm) ||
      article.description?.toLowerCase().includes(searchTerm) ||
      article.source.name.toLowerCase().includes(searchTerm)
    );
  } else {
    clearSearchBtn.style.display = 'none';
    filteredArticles = [...allArticles];
  }
  
  currentPage = 1;
  renderNews();
  
  // Save search interaction
  if (searchTerm) {
    saveNewsInteraction("news_searched", { search_term: searchTerm });
  }
}

// Clear search
function clearSearch() {
  newsSearch.value = '';
  clearSearchBtn.style.display = 'none';
  filteredArticles = [...allArticles];
  currentPage = 1;
  renderNews();
}

// Filter news by category
function filterNews() {
  if (currentFilter === "all") {
    filteredArticles = [...allArticles];
  } else {
    // Filter based on keywords in title and description
    const keywords = {
      health: ['health', 'medical', 'medicine', 'healthcare', 'wellness'],
      medical: ['medical', 'doctor', 'hospital', 'treatment', 'diagnosis', 'surgery'],
      wellness: ['wellness', 'fitness', 'nutrition', 'mental health', 'lifestyle']
    };
    
    const categoryKeywords = keywords[currentFilter] || [];
    
    filteredArticles = allArticles.filter(article => {
      const text = `${article.title} ${article.description}`.toLowerCase();
      return categoryKeywords.some(keyword => text.includes(keyword));
    });
  }
  
  // Apply current search if exists
  const searchTerm = newsSearch.value.toLowerCase().trim();
  if (searchTerm) {
    filteredArticles = filteredArticles.filter(article => 
      article.title.toLowerCase().includes(searchTerm) ||
      article.description?.toLowerCase().includes(searchTerm) ||
      article.source.name.toLowerCase().includes(searchTerm)
    );
  }
  
  currentPage = 1;
  renderNews();
  
  // Save filter interaction
  saveNewsInteraction("news_filtered", { filter: currentFilter });
}

// Load more articles
function loadMoreArticles() {
  currentPage++;
  renderAllNews();
}

// Refresh news
async function refreshNews() {
  refreshBtn.classList.add("loading");
  try {
    await loadHealthNews();
    showNotification("News updated successfully!", "success");
  } catch (error) {
    showNotification("Failed to refresh news.", "error");
  } finally {
    refreshBtn.classList.remove("loading");
  }
}

// Open news modal
function openNewsModal(articleIndex) {
  const article = allArticles[articleIndex];
  if (!article) return;
  
  newsModalBody.innerHTML = `
    <img src="${article.urlToImage || 'https://via.placeholder.com/800x300?text=Health+News'}" 
         alt="${article.title}" 
         class="modal-article-image"
         onerror="this.src='https://via.placeholder.com/800x300?text=Health+News'">
    <h1 class="modal-article-title">${article.title}</h1>
    <div class="modal-article-meta">
      <span class="modal-article-source">${article.source.name}</span>
      <span class="modal-article-date">
        <i class="fas fa-clock"></i>
        ${formatDate(article.publishedAt)}
      </span>
    </div>
    <div class="modal-article-content">
      ${article.content ? article.content.replace(/\[\+\d+ chars\]/, '') : article.description}
    </div>
    <a href="${article.url}" target="_blank" class="modal-article-link">
      Read Full Article <i class="fas fa-external-link-alt"></i>
    </a>
  `;
  
  newsModal.classList.add("active");
  document.body.style.overflow = "hidden";
  
  // Save article view interaction
  saveNewsInteraction("article_viewed", { 
    article_title: article.title,
    source: article.source.name 
  });
}

// Close news modal
function closeNewsModal() {
  newsModal.classList.remove("active");
  document.body.style.overflow = "";
}

// Update news statistics
function updateNewsStats() {
  const count = filteredArticles.length;
  newsCount.textContent = `${count} article${count !== 1 ? 's' : ''} found`;
}

// Show loading skeletons
function showLoadingSkeletons() {
  featuredNews.innerHTML = `
    <div class="loading-skeleton featured-skeleton">
      <div class="skeleton-image"></div>
      <div class="skeleton-content">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-meta"></div>
      </div>
    </div>
  `;
  
  newsGrid.innerHTML = Array(6).fill().map(() => `
    <div class="news-card-skeleton">
      <div class="skeleton-image"></div>
      <div class="skeleton-content">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-meta"></div>
      </div>
    </div>
  `).join('');
}

// Hide loading skeletons
function hideLoadingSkeletons() {
  // Skeletons are replaced by actual content in render functions
}

// Show error state
function showErrorState() {
  featuredNews.innerHTML = `
    <div class="no-results" style="grid-column: 1 / -1;">
      <div class="no-results-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Failed to load news</h3>
        <p>Please check your internet connection and try again</p>
        <button class="btn btn-primary" onclick="refreshNews()">
          Retry
        </button>
      </div>
    </div>
  `;
  
  newsGrid.innerHTML = '';
  loadMoreBtn.style.display = 'none';
  newsCount.textContent = 'Failed to load articles';
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// Save news interaction to Firebase
async function saveNewsInteraction(action, data = {}) {
  try {
    await addDoc(collection(db, "newsInteractions"), {
      userId: currentUser.uid,
      action,
      data,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving news interaction:", error);
  }
}

// Show notification
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.style.display = "none";
}

// Global functions
window.openNewsModal = openNewsModal;
window.clearSearch = clearSearch;
window.refreshNews = refreshNews;

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
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}