// ========================================
// ALIANÇA UNION - JAVASCRIPT PRINCIPAL
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // Menu Mobile
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      menuToggle.classList.toggle('active');
    });
    
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        menuToggle.classList.remove('active');
      });
    });
  }
  
  // Smooth scroll para âncoras
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      navbar.style.background = 'rgba(10, 10, 10, 0.98)';
      navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
    } else {
      navbar.style.background = 'rgba(10, 10, 10, 0.95)';
      navbar.style.boxShadow = 'none';
    }
  });
  
  // ========================================
  // SCROLL DOS CARDS (DRAG TO SCROLL)
  // ========================================
  
  function initDragScroll(container) {
    const scrollContainer = container.querySelector('.cards-scroll');
    if (!scrollContainer) return;
    
    let isDown = false;
    let startX;
    let scrollLeft;
    let startY;
    let scrollTop;
    
    // Mouse events
    scrollContainer.addEventListener('mousedown', (e) => {
      isDown = true;
      scrollContainer.style.cursor = 'grabbing';
      startX = e.pageX - scrollContainer.offsetLeft;
      scrollLeft = scrollContainer.scrollLeft;
    });
    
    scrollContainer.addEventListener('mouseleave', () => {
      isDown = false;
      scrollContainer.style.cursor = 'grab';
    });
    
    scrollContainer.addEventListener('mouseup', () => {
      isDown = false;
      scrollContainer.style.cursor = 'grab';
    });
    
    scrollContainer.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 2;
      scrollContainer.scrollLeft = scrollLeft - walk;
    });
    
    // Touch events for mobile
    scrollContainer.addEventListener('touchstart', (e) => {
      isDown = true;
      startX = e.touches[0].pageX - scrollContainer.offsetLeft;
      scrollLeft = scrollContainer.scrollLeft;
      startY = e.touches[0].pageY - scrollContainer.offsetTop;
      scrollTop = scrollContainer.scrollTop;
    }, { passive: true });
    
    scrollContainer.addEventListener('touchend', () => {
      isDown = false;
    });
    
    scrollContainer.addEventListener('touchmove', (e) => {
      if (!isDown) return;
      const x = e.touches[0].pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 2;
      scrollContainer.scrollLeft = scrollLeft - walk;
    }, { passive: true });
    
    scrollContainer.style.cursor = 'grab';
  }
  
  document.querySelectorAll('.cards-scroll-container').forEach(initDragScroll);
  
  // ========================================
  // LAYOUT TOGGLE (HORIZONTAL/VERTICAL)
  // ========================================
  
  window.setLayout = function(section, layout) {
    // Handle afiliados (multiple containers per category)
    const containers = document.querySelectorAll('[id^="' + section + '-"][id$="-container"]');
    if (containers.length === 0) {
      // Try single container (parcerias)
      const single = document.getElementById(section + '-container');
      if (single) applyLayout(single, layout);
    } else {
      containers.forEach(c => applyLayout(c, layout));
    }
    
    // Update active button in the section
    const toggle = document.querySelector('#' + section + ' .layout-toggle') || 
                   document.querySelector('[id^="' + section + '"] .layout-toggle');
    if (toggle) {
      toggle.querySelectorAll('.layout-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === layout);
      });
    }
    
    localStorage.setItem('union-layout-' + section, layout);
  };
  
  function applyLayout(container, layout) {
    const scroll = container.querySelector('.cards-scroll');
    if (!scroll) return;
    
    if (layout === 'vertical') {
      container.classList.add('vertical-layout');
      scroll.classList.add('vertical');
    } else {
      container.classList.remove('vertical-layout');
      scroll.classList.remove('vertical');
    }
  }
  
  // Load saved layouts
  ['parcerias', 'afiliados'].forEach(section => {
    const saved = localStorage.getItem('union-layout-' + section);
    if (saved) window.setLayout(section, saved);
  });
  
  // ========================================
  // ANIMAÇÃO DE ENTRADA AO SCROLL
  // ========================================
  
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);
  
  document.querySelectorAll('.card, .section').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
  
  // Counter animation para estatísticas
  const animateCounter = (element, target) => {
    let current = 0;
    const increment = target / 30;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        element.textContent = target;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current);
      }
    }, 30);
  };
  
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.textContent);
        if (!isNaN(target) && target > 0) {
          animateCounter(entry.target, target);
        }
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  document.querySelectorAll('.stat-number').forEach(el => {
    counterObserver.observe(el);
  });
});

function formatDate(dateString) {
  const options = { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString('pt-BR', options);
}
