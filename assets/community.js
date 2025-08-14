// assets/community.js - Community Discussion Functionality
import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay");
const createPostForm = document.getElementById("create-post-form");
const postContent = document.getElementById("post-content");
const postCategory = document.getElementById("post-category");
const postsFeed = document.getElementById("posts-feed");
const filterBtns = document.querySelectorAll(".filter-btn");
const postModal = document.getElementById("post-modal");
const postModalClose = document.querySelector(".post-modal-close");
const postModalBody = document.getElementById("post-modal-body");
const currentUsername = document.getElementById("current-username");
const currentUserBadge = document.getElementById("current-user-badge");

// Global Variables
let currentUser = null;
let currentUserData = null;
let currentFilter = "all";
let postsListener = null;

// Initialize Community
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        currentUserData = { id: user.uid, ...userDoc.data() };
        initializeCommunity();
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

// Initialize Community Features
async function initializeCommunity() {
  try {
    updateUserInfo();
    setupEventListeners();
    loadPosts();
    hideLoading();
  } catch (error) {
    console.error("Error initializing community:", error);
    hideLoading();
  }
}

// Update User Info Display
function updateUserInfo() {
  currentUsername.textContent = currentUserData.name;
  const badge = getUserBadge(currentUserData.role);
  currentUserBadge.innerHTML = badge.html;
  currentUserBadge.className = `user-badge ${badge.class}`;
}

// Get User Badge HTML and Class
function getUserBadge(role) {
  switch (role) {
    case "doctor":
      return {
        html: '<i class="fas fa-user-doctor"></i> Doctor',
        class: "badge-doctor"
      };
    case "pharmacy":
      return {
        html: '<i class="fas fa-pills"></i> Pharmacy',
        class: "badge-pharmacy"
      };
    default:
      return {
        html: '<i class="fas fa-user"></i> Patient',
        class: "badge-patient"
      };
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Create Post Form
  createPostForm.addEventListener("submit", handleCreatePost);

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      filterBtns.forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.filter;
      loadPosts();
    });
  });

  // Modal Close
  postModalClose.addEventListener("click", closePostModal);
  postModal.addEventListener("click", (e) => {
    if (e.target === postModal) closePostModal();
  });

  // ESC key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePostModal();
  });
}

// Handle Create Post
async function handleCreatePost(e) {
  e.preventDefault();
  
  const content = postContent.value.trim();
  const category = postCategory.value;
  
  if (!content) return;

  const submitBtn = e.target.querySelector(".post-submit-btn");
  submitBtn.classList.add("loading");
  
  try {
    await addDoc(collection(db, "communityPosts"), {
      content,
      category,
      authorId: currentUser.uid,
      authorName: currentUserData.name,
      authorRole: currentUserData.role,
      createdAt: serverTimestamp(),
      votes: {
        upvotes: [],
        downvotes: [],
        score: 0
      },
      commentCount: 0
    });

    // Reset form
    postContent.value = "";
    postCategory.value = "general";
    
    // Show success
    showNotification("Post shared successfully!", "success");
    
  } catch (error) {
    console.error("Error creating post:", error);
    showNotification("Failed to share post. Please try again.", "error");
  } finally {
    submitBtn.classList.remove("loading");
  }
}

// Load Posts
function loadPosts() {
  if (postsListener) {
    postsListener();
  }

  showPostsLoading();

  let postsQuery = query(
    collection(db, "communityPosts"),
    orderBy("createdAt", "desc")
  );

  if (currentFilter !== "all") {
    postsQuery = query(
      collection(db, "communityPosts"),
      where("category", "==", currentFilter),
      orderBy("createdAt", "desc")
    );
  }

  postsListener = onSnapshot(postsQuery, (snapshot) => {
    const posts = [];
    snapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() });
    });
    renderPosts(posts);
  });
}

// Render Posts
function renderPosts(posts) {
  if (posts.length === 0) {
    postsFeed.innerHTML = `
      <div class="no-posts glass">
        <div class="no-posts-content">
          <i class="fas fa-comments"></i>
          <h3>No posts yet</h3>
          <p>Be the first to start a discussion in this category!</p>
        </div>
      </div>
    `;
    return;
  }

  postsFeed.innerHTML = posts.map(post => createPostHTML(post)).join("");
  
  // Add event listeners to post elements
  setupPostEventListeners();
}

// Create Post HTML
function createPostHTML(post) {
  const timeAgo = getTimeAgo(post.createdAt?.toDate());
  const badge = getUserBadge(post.authorRole);
  const hasUpvoted = post.votes?.upvotes?.includes(currentUser.uid);
  const hasDownvoted = post.votes?.downvotes?.includes(currentUser.uid);

  return `
    <div class="post-item" data-post-id="${post.id}">
      <div class="post-header">
        <div class="user-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="post-user-info">
          <div class="post-username">
            ${post.authorName}
            <span class="user-badge ${badge.class}">${badge.html}</span>
          </div>
          <div class="post-meta">
            <span class="post-time">${timeAgo}</span>
            <span class="post-category-tag category-${post.category}">${post.category}</span>
          </div>
        </div>
      </div>
      
      <div class="post-content">
        ${post.content}
      </div>
      
      <div class="post-actions-bar">
        <div class="vote-buttons">
          <button class="vote-btn upvote ${hasUpvoted ? 'voted' : ''}" data-post-id="${post.id}" data-action="upvote">
            <i class="fas fa-arrow-up"></i>
            <span>${post.votes?.upvotes?.length || 0}</span>
          </button>
          <span class="vote-score">${post.votes?.score || 0}</span>
          <button class="vote-btn downvote ${hasDownvoted ? 'voted' : ''}" data-post-id="${post.id}" data-action="downvote">
            <i class="fas fa-arrow-down"></i>
            <span>${post.votes?.downvotes?.length || 0}</span>
          </button>
        </div>
        
        <button class="comment-btn" data-post-id="${post.id}">
          <i class="fas fa-comment"></i>
          <span>${post.commentCount || 0} Comments</span>
        </button>
      </div>
    </div>
  `;
}

// Setup Post Event Listeners
function setupPostEventListeners() {
  // Vote buttons
  document.querySelectorAll(".vote-btn").forEach(btn => {
    btn.addEventListener("click", handleVote);
  });

  // Comment buttons
  document.querySelectorAll(".comment-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const postId = e.currentTarget.dataset.postId;
      openPostModal(postId);
    });
  });

  // Post click (for mobile)
  document.querySelectorAll(".post-item").forEach(item => {
    item.addEventListener("click", (e) => {
      // Don't open modal if clicking on vote/comment buttons
      if (e.target.closest(".vote-btn") || e.target.closest(".comment-btn")) return;
      
      const postId = item.dataset.postId;
      openPostModal(postId);
    });
  });
}

// Handle Vote
async function handleVote(e) {
  e.stopPropagation();
  
  const postId = e.currentTarget.dataset.postId;
  const action = e.currentTarget.dataset.action;
  const userId = currentUser.uid;

  try {
    const postRef = doc(db, "communityPosts", postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) return;
    
    const postData = postDoc.data();
    const upvotes = postData.votes?.upvotes || [];
    const downvotes = postData.votes?.downvotes || [];
    
    let newUpvotes = [...upvotes];
    let newDownvotes = [...downvotes];
    
    if (action === "upvote") {
      if (upvotes.includes(userId)) {
        // Remove upvote
        newUpvotes = upvotes.filter(id => id !== userId);
      } else {
        // Add upvote and remove downvote if exists
        newUpvotes.push(userId);
        newDownvotes = downvotes.filter(id => id !== userId);
      }
    } else {
      if (downvotes.includes(userId)) {
        // Remove downvote
        newDownvotes = downvotes.filter(id => id !== userId);
      } else {
        // Add downvote and remove upvote if exists
        newDownvotes.push(userId);
        newUpvotes = upvotes.filter(id => id !== userId);
      }
    }
    
    const score = newUpvotes.length - newDownvotes.length;
    
    await updateDoc(postRef, {
      votes: {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        score: score
      }
    });

  } catch (error) {
    console.error("Error voting:", error);
    showNotification("Failed to vote. Please try again.", "error");
  }
}

// Open Post Modal
async function openPostModal(postId) {
  try {
    const postDoc = await getDoc(doc(db, "communityPosts", postId));
    if (!postDoc.exists()) return;

    const post = { id: postDoc.id, ...postDoc.data() };
    await loadPostWithComments(post);
    postModal.classList.add("active");
    document.body.style.overflow = "hidden";
    
  } catch (error) {
    console.error("Error opening post modal:", error);
    showNotification("Failed to load post.", "error");
  }
}

// Close Post Modal
function closePostModal() {
  postModal.classList.remove("active");
  document.body.style.overflow = "";
}

// Load Post with Comments
async function loadPostWithComments(post) {
  const badge = getUserBadge(post.authorRole);
  const timeAgo = getTimeAgo(post.createdAt?.toDate());
  const hasUpvoted = post.votes?.upvotes?.includes(currentUser.uid);
  const hasDownvoted = post.votes?.downvotes?.includes(currentUser.uid);

  postModalBody.innerHTML = `
    <div class="modal-post">
      <div class="post-header">
        <div class="user-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="post-user-info">
          <div class="post-username">
            ${post.authorName}
            <span class="user-badge ${badge.class}">${badge.html}</span>
          </div>
          <div class="post-meta">
            <span class="post-time">${timeAgo}</span>
            <span class="post-category-tag category-${post.category}">${post.category}</span>
          </div>
        </div>
      </div>
      
      <div class="post-content">
        ${post.content}
      </div>
      
      <div class="post-actions-bar">
        <div class="vote-buttons">
          <button class="vote-btn upvote ${hasUpvoted ? 'voted' : ''}" data-post-id="${post.id}" data-action="upvote">
            <i class="fas fa-arrow-up"></i>
            <span>${post.votes?.upvotes?.length || 0}</span>
          </button>
          <span class="vote-score">${post.votes?.score || 0}</span>
          <button class="vote-btn downvote ${hasDownvoted ? 'voted' : ''}" data-post-id="${post.id}" data-action="downvote">
            <i class="fas fa-arrow-down"></i>
            <span>${post.votes?.downvotes?.length || 0}</span>
          </button>
        </div>
      </div>
    </div>
    
    <div class="comments-section">
      <div class="comments-header">
        <h4 class="comments-title">Comments</h4>
      </div>
      
      <form class="comment-form">
        <textarea class="reply-textarea" placeholder="Add a comment..." required></textarea>
        <div class="reply-actions">
          <button type="submit" class="reply-submit">Comment</button>
        </div>
      </form>
      
      <div class="comments-list">
        <div class="loading-comments">Loading comments...</div>
      </div>
    </div>
  `;

  // Setup modal event listeners
  setupModalEventListeners(post.id);
  
  // Load comments
  loadComments(post.id);
}

// Setup Modal Event Listeners
function setupModalEventListeners(postId) {
  // Vote buttons in modal
  postModalBody.querySelectorAll(".vote-btn").forEach(btn => {
    btn.addEventListener("click", handleVote);
  });

  // Comment form
  const commentForm = postModalBody.querySelector(".comment-form");
  commentForm.addEventListener("submit", (e) => handleAddComment(e, postId));
}

// Handle Add Comment
async function handleAddComment(e, postId) {
  e.preventDefault();
  
  const textarea = e.target.querySelector(".reply-textarea");
  const content = textarea.value.trim();
  
  if (!content) return;

  const submitBtn = e.target.querySelector(".reply-submit");
  submitBtn.classList.add("loading");
  
  try {
    await addDoc(collection(db, "communityComments"), {
      postId,
      content,
      authorId: currentUser.uid,
      authorName: currentUserData.name,
      authorRole: currentUserData.role,
      createdAt: serverTimestamp(),
      votes: {
        upvotes: [],
        downvotes: [],
        score: 0
      }
    });

    // Update post comment count
    await updateDoc(doc(db, "communityPosts", postId), {
      commentCount: increment(1)
    });

    textarea.value = "";
    
  } catch (error) {
    console.error("Error adding comment:", error);
    showNotification("Failed to add comment.", "error");
  } finally {
    submitBtn.classList.remove("loading");
  }
}

// Load Comments
function loadComments(postId) {
  const commentsQuery = query(
    collection(db, "communityComments"),
    where("postId", "==", postId),
    orderBy("createdAt", "asc")
  );

  onSnapshot(commentsQuery, (snapshot) => {
    const comments = [];
    snapshot.forEach((doc) => {
      comments.push({ id: doc.id, ...doc.data() });
    });
    renderComments(comments);
  });
}

// Render Comments
function renderComments(comments) {
  const commentsList = postModalBody.querySelector(".comments-list");
  
  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
    return;
  }

  commentsList.innerHTML = comments.map(comment => createCommentHTML(comment)).join("");
  
  // Setup comment event listeners
  setupCommentEventListeners();
}

// Create Comment HTML
function createCommentHTML(comment) {
  const timeAgo = getTimeAgo(comment.createdAt?.toDate());
  const badge = getUserBadge(comment.authorRole);

  return `
    <div class="comment-item">
      <div class="comment-header">
        <div class="comment-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="comment-user-info">
          <div class="comment-username">
            ${comment.authorName}
            <span class="user-badge ${badge.class}">${badge.html}</span>
          </div>
          <div class="comment-time">${timeAgo}</div>
        </div>
      </div>
      
      <div class="comment-content">
        ${comment.content}
      </div>
      
      <div class="comment-actions">
        <div class="vote-buttons">
          <button class="vote-btn upvote" data-comment-id="${comment.id}" data-action="upvote">
            <i class="fas fa-arrow-up"></i>
            <span>${comment.votes?.upvotes?.length || 0}</span>
          </button>
          <span class="vote-score">${comment.votes?.score || 0}</span>
          <button class="vote-btn downvote" data-comment-id="${comment.id}" data-action="downvote">
            <i class="fas fa-arrow-down"></i>
            <span>${comment.votes?.downvotes?.length || 0}</span>
          </button>
        </div>
        
        <button class="reply-btn" data-comment-id="${comment.id}">
          <i class="fas fa-reply"></i>
          Reply
        </button>
      </div>
    </div>
  `;
}

// Setup Comment Event Listeners
function setupCommentEventListeners() {
  // Comment vote buttons
  postModalBody.querySelectorAll(".comment-item .vote-btn").forEach(btn => {
    btn.addEventListener("click", handleCommentVote);
  });

  // Reply buttons
  postModalBody.querySelectorAll(".reply-btn").forEach(btn => {
    btn.addEventListener("click", handleReply);
  });
}

// Handle Comment Vote
async function handleCommentVote(e) {
  e.stopPropagation();
  
  const commentId = e.currentTarget.dataset.commentId;
  const action = e.currentTarget.dataset.action;
  const userId = currentUser.uid;

  try {
    const commentRef = doc(db, "communityComments", commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) return;
    
    const commentData = commentDoc.data();
    const upvotes = commentData.votes?.upvotes || [];
    const downvotes = commentData.votes?.downvotes || [];
    
    let newUpvotes = [...upvotes];
    let newDownvotes = [...downvotes];
    
    if (action === "upvote") {
      if (upvotes.includes(userId)) {
        newUpvotes = upvotes.filter(id => id !== userId);
      } else {
        newUpvotes.push(userId);
        newDownvotes = downvotes.filter(id => id !== userId);
      }
    } else {
      if (downvotes.includes(userId)) {
        newDownvotes = downvotes.filter(id => id !== userId);
      } else {
        newDownvotes.push(userId);
        newUpvotes = upvotes.filter(id => id !== userId);
      }
    }
    
    const score = newUpvotes.length - newDownvotes.length;
    
    await updateDoc(commentRef, {
      votes: {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        score: score
      }
    });

  } catch (error) {
    console.error("Error voting on comment:", error);
    showNotification("Failed to vote. Please try again.", "error");
  }
}

// Handle Reply (placeholder for future implementation)
function handleReply(e) {
  const commentId = e.currentTarget.dataset.commentId;
  // For now, just show notification
  showNotification("Reply feature coming soon!", "info");
}

// Utility Functions
function getTimeAgo(date) {
  if (!date) return "Just now";
  
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

function showPostsLoading() {
  postsFeed.innerHTML = `
    <div class="loading-posts">
      <div class="skeleton post-skeleton">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text"></div>
        </div>
      </div>
    </div>
  `;
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

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

// Add notification styles to CSS if not already present
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