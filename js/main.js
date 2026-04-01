document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const sunIcon = document.getElementById("icon-sun");
  const moonIcon = document.getElementById("icon-moon");

  const updateToggleUI = (isDark) => {
    if (isDark) {
      sunIcon.classList.remove("hidden");
      moonIcon.classList.add("hidden");
    } else {
      sunIcon.classList.add("hidden");
      moonIcon.classList.remove("hidden");
    }
  };

  const currentTheme = localStorage.getItem("theme") || "system";
  const isSystemDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const isInitiallyDark =
    currentTheme === "dark" || (currentTheme === "system" && isSystemDark);

  if (toggleBtn) {
    updateToggleUI(isInitiallyDark);

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const isDarkNow = document.documentElement.classList.contains("dark");
      const nextTheme = isDarkNow ? "light" : "dark";
      AetherUI.setTheme(nextTheme);
    });
  }

  document.addEventListener("aether:theme-change", (e) => {
    const newTheme = e.detail.theme;
    let isDark = false;
    if (newTheme === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      isDark = newTheme === "dark";
    }
    if (toggleBtn) updateToggleUI(isDark);
  });

  const initBackToTop = () => {
    const backToTopBtn = document.getElementById("back-to-top");

    if (!backToTopBtn) return;

    const toggleButtonVisibility = () => {
      if (window.scrollY > 600) {
        backToTopBtn.classList.remove(
          "translate-y-20",
          "opacity-0",
          "invisible",
        );
      } else {
        backToTopBtn.classList.add("translate-y-20", "opacity-0", "invisible");
      }
    };

    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

    window.addEventListener("scroll", toggleButtonVisibility);

    backToTopBtn.addEventListener("click", scrollToTop);

    toggleButtonVisibility();
  };

  const initCountUp = () => {
    const selector = "[data-countup]";
    const elements = document.querySelectorAll(selector);

    if (elements.length > 0) {
      const observer = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = entry.target;
              const endValue = parseFloat(el.getAttribute("data-countup"));
              const options = {
                duration: 2.5,
                separator: ".",
                decimal: ",",
                ...JSON.parse(el.getAttribute("data-countup-options") || "{}"),
              };

              const countUpAnim = new countUp.CountUp(el, endValue, options);

              if (!countUpAnim.error) {
                countUpAnim.start();
              } else {
                console.error(countUpAnim.error);
              }

              observer.unobserve(el);
            }
          });
        },
        { threshold: 0.5 },
      );

      elements.forEach((el) => observer.observe(el));
    }
  };
  initCountUp();
  initBackToTop();
});

var swiper = new Swiper(".swiperMain", {
  loop: true,
  effect: "fade",
  speed: 500,
  fadeEffect: { crossFade: true },
  parallax: true,
  navigation: { nextEl: ".main-next", prevEl: ".main-prev" },
  keyboard: { enabled: true },
  pagination: { el: ".swiper-pagination", clickable: true },
  autoplay: { delay: 5000, disableOnInteraction: true },
});

var productSwiper = new Swiper(".swiperProducts", {
  slidesPerView: 1,
  spaceBetween: 20,
  loop: true,
  navigation: { nextEl: ".product-next", prevEl: ".product-prev" },
  breakpoints: {
    640: { slidesPerView: 2, spaceBetween: 30 },
    1024: { slidesPerView: 3, spaceBetween: 40 },
    1280: { slidesPerView: 2, spaceBetween: 60 },
    1920: { slidesPerView: 3, spaceBetween: 60 },
  },
});

var certificateSwiper = new Swiper(".swiperCertificates", {
  slidesPerView: 2,
  spaceBetween: 20,
  loop: true,
  navigation: { nextEl: ".certificate-next", prevEl: ".certificate-prev" },
  breakpoints: {
    640: { slidesPerView: 3, spaceBetween: 30 },
    1536: { slidesPerView: 4, spaceBetween: 60 },
  },
});

Fancybox.bind("[data-fancybox]", {
  Carousel: { infinite: true, transition: "classic" },
  Thumbs: { autoStart: true, type: "classic" },
  Toolbar: {
    display: {
      left: ["infobar"],
      middle: ["zoomIn", "zoomOut", "rotateCCW", "rotateCW", "flipX", "flipY"],
      right: ["slideshow", "thumbs", "fullscreen", "download", "close"],
    },
  },
  Images: { zoom: true, Panzoom: { maxScale: 4 } },
  Slideshow: { timeout: 3000 },
  Hash: true,
});

document.addEventListener("DOMContentLoaded", () => {
  const initMarquee = () => {
    const track = document.getElementById("marquee-track");
    if (!track) return;
    const items = Array.from(track.children);
    items.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
  };

  initMarquee();
});
