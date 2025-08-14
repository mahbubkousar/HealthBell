// assets/homepage-news.js - Homepage Health News Preview
// NewsAPI Configuration
const NEWS_API_KEY = "8a7e86793d054c198f6919d7ff21bafe";
const NEWS_API_URL = "https://newsapi.org/v2/top-headlines";

// DOM Elements
const homepageNews = document.getElementById("homepage-news");
const homepageNewsModal = document.getElementById("homepage-news-modal");
let homepageNewsModalClose, homepageNewsModalBody;

// Global Variables
let homepageArticles = [];

// Initialize homepage news
document.addEventListener('DOMContentLoaded', function() {
  loadHomepageNews();
  setupHomepageNewsModal();
});

// Load health news for homepage
async function loadHomepageNews() {
  try {
    const apiUrl = `${NEWS_API_URL}?country=us&category=health&pageSize=6&apiKey=${NEWS_API_KEY}`;
    console.log("Fetching news from:", apiUrl);
    
    // Fetch health news from NewsAPI
    const response = await fetch(apiUrl);
    
    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(`NewsAPI request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log("API response data:", data);
    
    if (data.status === "ok" && data.articles) {
      homepageArticles = data.articles.filter(article => 
        article.title && 
        article.title !== "[Removed]" &&
        article.description && 
        article.description !== "[Removed]" &&
        article.urlToImage
      ).slice(0, 3); // Show only 3 articles on homepage
      
      console.log("Filtered articles:", homepageArticles.length);
      renderHomepageNews();
    } else {
      console.error("Invalid response structure:", data);
      throw new Error("Invalid response from NewsAPI");
    }
    
  } catch (error) {
    console.error("Error loading homepage news:", error);
    showHomepageNewsError();
  }
}

// Render homepage news
function renderHomepageNews() {
  if (homepageArticles.length === 0) {
    showHomepageNewsError();
    return;
  }
  
  const newsHTML = homepageArticles.map((article, index) => `
    <div class="news-preview-card" onclick="openHomepageNewsModal(${index})" 
         style="animation-delay: ${index * 0.2}s">
      <img src="${article.urlToImage}" 
           alt="${article.title}" 
           class="news-preview-image"
           onerror="this.src='https://via.placeholder.com/300x180?text=Health+News'">
      <div class="news-preview-content">
        <div class="news-preview-category">Health</div>
        <h3 class="news-preview-title">${article.title}</h3>
        <p class="news-preview-description">${article.description || ''}</p>
        <div class="news-preview-meta">
          <span class="news-preview-source">${article.source.name}</span>
          <span class="news-preview-date">${formatDate(article.publishedAt)}</span>
        </div>
      </div>
    </div>
  `).join('');
  
  homepageNews.innerHTML = newsHTML;
}

// Show error state for homepage news
function showHomepageNewsError() {
  homepageNews.innerHTML = `
    <div class="news-preview-error" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
      <div style="color: var(--color-gray); margin-bottom: 1rem;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; opacity: 0.5;"></i>
      </div>
      <h3 style="color: var(--color-text); margin-bottom: 0.5rem;">Unable to load news</h3>
      <p style="color: var(--color-text-light);">Please check your internet connection and try refreshing the page</p>
    </div>
  `;
}

// Setup homepage news modal
function setupHomepageNewsModal() {
  // Create modal HTML if it doesn't exist
  if (!document.getElementById('homepage-news-modal')) {
    const modalHTML = `
      <div id="homepage-news-modal" class="homepage-news-modal">
        <div class="homepage-news-modal-content">
          <div class="homepage-news-modal-header">
            <button class="homepage-news-modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div id="homepage-news-modal-body" class="homepage-news-modal-body">
            <!-- Article content will be loaded here -->
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
  
  // Get modal elements
  const modal = document.getElementById('homepage-news-modal');
  homepageNewsModalClose = document.querySelector('.homepage-news-modal-close');
  homepageNewsModalBody = document.getElementById('homepage-news-modal-body');
  
  // Setup event listeners
  if (homepageNewsModalClose) {
    homepageNewsModalClose.addEventListener('click', closeHomepageNewsModal);
  }
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeHomepageNewsModal();
    });
  }
  
  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHomepageNewsModal();
  });
}

// Open homepage news modal
function openHomepageNewsModal(articleIndex) {
  const article = homepageArticles[articleIndex];
  if (!article) return;
  
  const modal = document.getElementById('homepage-news-modal');
  if (!modal || !homepageNewsModalBody) return;
  
  homepageNewsModalBody.innerHTML = `
    <img src="${article.urlToImage}" 
         alt="${article.title}" 
         class="modal-article-image"
         onerror="this.src='https://via.placeholder.com/600x300?text=Health+News'"
         style="width: 100%; height: 250px; object-fit: cover; border-radius: 12px; margin-bottom: 1.5rem;">
    <h1 style="font-size: 1.5rem; font-weight: 700; color: var(--color-text); margin-bottom: 1rem; line-height: 1.3;">
      ${article.title}
    </h1>
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
      <span style="font-weight: 600; color: var(--color-primary); font-size: 1rem;">${article.source.name}</span>
      <span style="color: var(--color-gray); display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas fa-clock"></i>
        ${formatDate(article.publishedAt)}
      </span>
    </div>
    <div style="color: var(--color-text-light); line-height: 1.7; font-size: 1rem; margin-bottom: 2rem;">
      ${article.content ? article.content.replace(/\[\+\d+ chars\]/, '') : article.description}
    </div>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
      <a href="${article.url}" target="_blank" 
         style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; background: var(--color-primary); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; transition: all 0.3s ease;">
        Read Full Article <i class="fas fa-external-link-alt"></i>
      </a>
      <a href="/register.html" 
         style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; transition: all 0.3s ease;">
        <i class="fas fa-user-plus"></i>
        Register for More News
      </a>
    </div>
  `;
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close homepage news modal
function closeHomepageNewsModal() {
  const modal = document.getElementById('homepage-news-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
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

// Global function for onclick
window.openHomepageNewsModal = openHomepageNewsModal;