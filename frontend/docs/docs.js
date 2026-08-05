document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCopyCode();
  initScrollSpy();
  initThemeToggle();
});

function initMobileMenu() {
  const btn = document.getElementById("docs-mobile-menu-btn");
  const sidebar = document.getElementById("docs-sidebar");

  if (!btn || !sidebar) return;

  btn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (e) => {
    if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });
}

function initCopyCode() {
  const copyBtns = document.querySelectorAll(".docs-btn-copy");

  copyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const blockWrapper = btn.closest(".docs-code-block-wrapper");
      if (!blockWrapper) return;

      const codeEl = blockWrapper.querySelector(".docs-code-block code");
      if (!codeEl) return;

      const text = codeEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        btn.style.color = "var(--success)";

        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.color = "";
        }, 2000);
      }).catch(err => {
        console.error("Failed to copy code: ", err);
      });
    });
  });
}


function initScrollSpy() {
  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -80% 0px",
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll(".docs-toc-link, .docs-nav-link").forEach(link => {
          link.classList.remove("active");
        });

        // Highlight active link in both sidebars
        const tocLink = document.querySelector(`.docs-toc-link[href="#${id}"]`);
        const navLink = document.querySelector(`.docs-nav-link[href="#${id}"]`);

        if (tocLink) tocLink.classList.add("active");
        if (navLink) navLink.classList.add("active");
      }
    });
  }, observerOptions);

  document.querySelectorAll("#docs-article h1, #docs-article h2, #docs-article h3").forEach(heading => {
    if (heading.id) {
      observer.observe(heading);
    }
  });
}

function initThemeToggle() {
  const toggleBtn = document.getElementById("theme-toggle");
  const iconMoon = document.getElementById("theme-icon-moon");
  const iconSun = document.getElementById("theme-icon-sun");

  if (!toggleBtn) return;

  const currentTheme = localStorage.getItem("noviq_theme") || "light";
  if (currentTheme === "dark") {
    iconMoon.style.display = "none";
    iconSun.style.display = "block";
  }

  toggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("noviq_theme", "light");
      iconMoon.style.display = "block";
      iconSun.style.display = "none";
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("noviq_theme", "dark");
      iconMoon.style.display = "none";
      iconSun.style.display = "block";
    }
  });
}
