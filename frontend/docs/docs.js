document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCopyCode();
  initScrollSpy();
  initThemeToggle();
});

function initMobileMenu() {
  const btn = document.getElementById("docs-mobile-menu-btn");
  const sidebar = document.getElementById("docs-sidebar");
  const backdrop = document.getElementById("docs-sidebar-backdrop");

  if (!btn || !sidebar) return;

  function toggleSidebar(open) {
    const shouldOpen = open !== undefined ? open : !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", shouldOpen);
    if (backdrop) backdrop.classList.toggle("open", shouldOpen);
    document.body.style.overflow = shouldOpen ? "hidden" : "";
  }

  btn.addEventListener("click", () => toggleSidebar());

  if (backdrop) {
    backdrop.addEventListener("click", () => toggleSidebar(false));
  }

  // Close sidebar when clicking any nav link on mobile
  sidebar.querySelectorAll(".docs-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        toggleSidebar(false);
      }
    });
  });

  // Close sidebar on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) {
      toggleSidebar(false);
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
