// ═══ Video Fade Loop Logic ═══
const heroVideo = document.getElementById('heroVideo');
if (heroVideo) {
  heroVideo.play().catch(() => {});
}

// ═══ Nav Scroll Effect ═══
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
});

// ═══ Active Nav Link Tracking ═══
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
const linkObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + id);
      });
    }
  });
}, { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' });
sections.forEach(s => linkObserver.observe(s));

// ═══ Smooth Scroll for Anchors ═══
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ═══ Reveal on Scroll ═══
const revealEls = document.querySelectorAll('.reveal');
const pipelineSteps = document.querySelectorAll('.pipeline-step');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
revealEls.forEach(el => revealObserver.observe(el));
pipelineSteps.forEach((s, i) => {
  s.style.transitionDelay = `${i * 0.12}s`;
  revealObserver.observe(s);
});

// ═══ Impact Cards Staggered Slide-In ═══
const impactCards = document.querySelectorAll('.impact-card-slide');
impactCards.forEach((card, i) => {
  card.style.transitionDelay = `${i * 0.15}s`;
});
const impactObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      impactObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
impactCards.forEach(card => impactObserver.observe(card));


// ═══ Counter Animation ═══
const counters = document.querySelectorAll('.stat-value[data-target]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const target = parseInt(e.target.dataset.target);
      const suffix = e.target.dataset.suffix || '';
      const startTime = performance.now();
      function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
      function update(now) {
        const p = Math.min((now - startTime) / 1500, 1);
        e.target.textContent = Math.floor(easeOut(p) * target) + suffix;
        if (p < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
counters.forEach(c => counterObserver.observe(c));

// ═══ Tilt Effect for Cards ═══
document.querySelectorAll('.sol-card, .impact-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `translateY(-6px) perspective(600px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});

// ═══ Subtle Parallax on Hero ═══
const heroContent = document.querySelector('.hero-content');
if (heroContent) {
  window.addEventListener('scroll', () => {
    const s = window.scrollY;
    if (s < window.innerHeight) {
      heroContent.style.transform = `translateY(${s * 0.15}px)`;
    }
  });
}

console.log('🌿 Air Vision — Cinematic Redesign loaded');

// ═══ Solution Carousel Logic ═══
let currentSlide = 0;
window.slideCarousel = function(direction) {
  const track = document.getElementById('solCarouselTrack');
  const cards = document.querySelectorAll('.sol-card');
  if (!track || cards.length === 0) return;
  
  const cardWidth = cards[0].offsetWidth;
  const gap = 32;
  const totalSlides = cards.length;
  
  currentSlide += direction;
  
  if (currentSlide < 0) currentSlide = 0;
  if (currentSlide > totalSlides - 1) currentSlide = totalSlides - 1;
  
  const moveAmount = currentSlide * (cardWidth + gap);
  track.style.transform = `translateX(-${moveAmount}px)`;
};
