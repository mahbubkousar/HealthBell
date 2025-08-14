// assets/main.js

document.addEventListener("DOMContentLoaded", () => {
  // --- MOBILE MENU ---
  const hamburger = document.querySelector(".hamburger");
  const mainNav = document.querySelector(".main-nav");
  const body = document.body;

  if (hamburger && mainNav) {
    hamburger.addEventListener("click", () => {
      // Toggle classes for the nav menu and body
      mainNav.classList.toggle("active");
      body.classList.toggle("menu-open");

      // Change hamburger icon to 'X' and back
      const icon = hamburger.querySelector("i");
      if (mainNav.classList.contains("active")) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-times");
      } else {
        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");
      }
    });
  }

  // --- MODERN ANIMATION SYSTEM ON SCROLL ---
  const animatedElements = document.querySelectorAll(".fade-in, .slide-in-left, .slide-in-right, .scale-in");

  if (animatedElements.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            // Don't unobserve for elements that might need to animate again
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px", // Trigger animation slightly before element comes into view
      }
    );

    animatedElements.forEach((element) => {
      observer.observe(element);
    });
  }

  // --- SMOOTH SCROLLING FOR ANCHOR LINKS ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // --- ADD DYNAMIC LOADING STATES ---
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    if (button.type === 'submit' || button.classList.contains('auth-btn')) {
      button.addEventListener('click', function() {
        // Add loading state temporarily for better UX
        if (!this.classList.contains('loading')) {
          this.classList.add('loading');
          // Remove loading state after a delay if no form submission occurs
          setTimeout(() => {
            this.classList.remove('loading');
          }, 3000);
        }
      });
    }
  });

  // --- ENHANCED FORM INTERACTIONS ---
  const formInputs = document.querySelectorAll('.form-input');
  formInputs.forEach(input => {
    // Add focus/blur effects for better visual feedback
    input.addEventListener('focus', function() {
      this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
      this.parentElement.classList.remove('focused');
      if (this.value.trim() !== '') {
        this.parentElement.classList.add('filled');
      } else {
        this.parentElement.classList.remove('filled');
      }
    });
    
    // Check if input is pre-filled on load
    if (input.value.trim() !== '') {
      input.parentElement.classList.add('filled');
    }
  });
});
