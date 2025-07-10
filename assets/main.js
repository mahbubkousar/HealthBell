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

  // --- FADE-IN ANIMATION ON SCROLL ---
  const fadeInElements = document.querySelectorAll(".fade-in");

  if (fadeInElements.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
      }
    );

    fadeInElements.forEach((element) => {
      observer.observe(element);
    });
  }
});
