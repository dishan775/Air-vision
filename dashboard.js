// ── Dashboard JS — Shared across all dashboard pages ──

// ── Sidebar Active State ──
(function() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage) a.classList.add('active');
    else a.classList.remove('active');
  });
})();

// ── Mobile Sidebar Toggle ──
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.querySelector('.menu-toggle');
  if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
    sidebar.classList.remove('open');
  }
});

// ── Profile Dropdown ──
const profileBtn = document.querySelector('.topbar-profile');
const profileDropdown = document.querySelector('.profile-dropdown');
if (profileBtn && profileDropdown) {
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('show');
  });
  document.addEventListener('click', () => profileDropdown.classList.remove('show'));
}

// ── Animated Counters ──
function animateCounter(el, target, suffix = '', duration = 1500) {
  let start = 0;
  const startTime = performance.now();
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.floor(easeOut(progress) * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const target = parseFloat(e.target.dataset.target);
      const suffix = e.target.dataset.suffix || '';
      animateCounter(e.target, target, suffix);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => counterObserver.observe(el));

// ── Reveal on Scroll ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Sparkline Mini Charts ──
function drawSparkline(canvasId, data, color = '#34d67a') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.offsetWidth;
  const h = canvas.height = 30;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);

  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = i * step;
    const y = h - ((val - min) / range) * (h - 4) - 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Gradient fill
  const lastX = (data.length - 1) * step;
  ctx.lineTo(lastX, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color.replace(')', ',0.15)').replace('rgb', 'rgba'));
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();
}

// ── Map Integration (Leaflet & OpenWeatherMap) ──
let weatherMap = null;
let activeWeatherLayer = null;
let currentLayerType = 'TA2'; // Default: Temperature

function initMap(lat, lon) {
  if (weatherMap) {
    weatherMap.flyTo([lat, lon], 10, { animate: true, duration: 1.5 });
    return;
  }

  // Initialize Map
  weatherMap = L.map('weatherMap', { zoomControl: false }).setView([lat, lon], 10);
  
  // Sleek Dark Base Map (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO'
  }).addTo(weatherMap);

  // Initial Weather Layer
  updateWeatherLayer(currentLayerType);

  // Map Toggles Event Listeners
  document.querySelectorAll('.map-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.map-toggle').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentLayerType = e.target.dataset.layer;
      updateWeatherLayer(currentLayerType);
    });
  });
}

function updateWeatherLayer(layerType) {
  if (!weatherMap) return;
  if (activeWeatherLayer) {
    weatherMap.removeLayer(activeWeatherLayer);
  }
  const url = `https://maps.openweathermap.org/maps/2.0/weather/${layerType}/{z}/{x}/{y}?appid=${weatherApiKey}&fill_bound=true`;
  activeWeatherLayer = L.tileLayer(url, {
    opacity: 0.65,
    maxZoom: 18
  }).addTo(weatherMap);
}

// ── Particle Background ──
function initParticles(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      position:absolute; border-radius:50%;
      background:rgba(52,214,122,0.12);
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%; top:${Math.random()*100}%;
      animation:particleFloat ${Math.random()*10+10}s linear infinite;
      animation-delay:${Math.random()*5}s; opacity:${Math.random()*0.3+0.1};
    `;
    container.appendChild(p);
  }
}

// Add particle keyframes
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes particleFloat {
    0% { transform:translateY(0) translateX(0); opacity:0; }
    10% { opacity:0.3; }
    90% { opacity:0.3; }
    100% { transform:translateY(-100vh) translateX(${Math.random()*40-20}px); opacity:0; }
  }
`;
document.head.appendChild(styleSheet);

// ── Toggle Button ──
document.querySelectorAll('.toggle').forEach(toggle => {
  toggle.addEventListener('click', () => toggle.classList.toggle('active'));
});

// ── Chart.js Helpers ──
function createLineChart(canvasId, labels, datasets, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return null;
  return new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: options.legend !== false, labels: { color: 'rgba(240,240,235,0.5)', font: { family: 'Inter', size: 11 } } },
      },
      scales: {
        x: { ticks: { color: 'rgba(240,240,235,0.3)', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(52,214,122,0.05)' } },
        y: { ticks: { color: 'rgba(240,240,235,0.3)', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(52,214,122,0.05)' } },
      },
      elements: { point: { radius: 3, hoverRadius: 5 }, line: { tension: 0.4 } },
      interaction: { intersect: false, mode: 'index' },
      ...options
    }
  });
}

function createBarChart(canvasId, labels, data, color = 'rgba(52,214,122,0.6)') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return null;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: color, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(240,240,235,0.3)', font: { family: 'Inter', size: 10 } }, grid: { display: false } },
        y: { ticks: { color: 'rgba(240,240,235,0.3)', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(52,214,122,0.05)' } },
      }
    }
  });
}

function createDoughnutChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return null;
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: 'rgba(240,240,235,0.5)', padding: 16, font: { family: 'Inter', size: 11 } } }
      }
    }
  });
}

// ── Live Weather Integration ──
const weatherApiKey = '52af0cefc5021adb7cce0f20fac19bf4';

async function fetchWeather(city) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${weatherApiKey}`);
    if (!res.ok) throw new Error('City not found');
    const data = await res.json();
    
    // Update Location Label explicitly
    const locLabel = document.getElementById('weatherLocationLabel');
    if(locLabel) {
      locLabel.textContent = `📍 ${data.name}, ${data.sys.country}`;
    }

    // Update Temperature
    const tempVal = document.getElementById('valTemp');
    const tempUnit = document.getElementById('unitTemp');
    const tempTrend = document.getElementById('trendTemp');
    if(tempVal) {
      // Re-trigger animation
      tempVal.dataset.target = data.main.temp;
      animateCounter(tempVal, data.main.temp, '°C');
      tempUnit.textContent = `Feels like ${Math.round(data.main.feels_like)}°C`;
      tempTrend.textContent = `${data.weather[0].main} — ${data.weather[0].description}`;
    }

    // Update Humidity
    const humidVal = document.getElementById('valHumid');
    const humidUnit = document.getElementById('unitHumid');
    const humidTrend = document.getElementById('trendHumid');
    if(humidVal) {
      humidVal.dataset.target = data.main.humidity;
      animateCounter(humidVal, data.main.humidity, '%');
      humidUnit.textContent = `Wind: ${data.wind.speed} m/s`;
      humidTrend.textContent = `Pressure: ${data.main.pressure} hPa`;
    }
    
    // Update Map
    if (data.coord && typeof L !== 'undefined') {
      const mapTitle = document.getElementById('mapCardTitle');
      if(mapTitle) mapTitle.textContent = `🗺️ ${data.name} Map Overview`;
      initMap(data.coord.lat, data.coord.lon);
      fetchAirPollution(data.coord.lat, data.coord.lon);
    }
    
  } catch (err) {
    console.error('Weather fetch error:', err);
    const tempVal = document.getElementById('valTemp');
    if(tempVal) tempVal.textContent = 'Err';
    const locLabel = document.getElementById('weatherLocationLabel');
    if(locLabel) locLabel.textContent = '📍 Location not found';
  }
}

async function fetchAirPollution(lat, lon) {
  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${weatherApiKey}`),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${weatherApiKey}`)
    ]);
    
    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();
    
    // PM2.5 to US AQI Conversion
    function calcAQI(pm25) {
      if (pm25 <= 12.0) return Math.round((50/12.0) * pm25);
      if (pm25 <= 35.4) return Math.round(((100-51)/(35.4-12.1)) * (pm25-12.1) + 51);
      if (pm25 <= 55.4) return Math.round(((150-101)/(55.4-35.5)) * (pm25-35.5) + 101);
      if (pm25 <= 150.4) return Math.round(((200-151)/(150.4-55.5)) * (pm25-55.5) + 151);
      if (pm25 <= 250.4) return Math.round(((300-201)/(250.4-150.5)) * (pm25-150.5) + 201);
      return Math.round(((500-301)/(500.4-250.5)) * (pm25-250.5) + 301);
    }
    
    // Update Current AQI
    if (currentData.list && currentData.list.length > 0) {
      const aqi = currentData.list[0].main.aqi;
      const pm25 = currentData.list[0].components.pm2_5;
      
      const aqiMap = {
        1: { label: 'Good', desc: 'Air quality is considered satisfactory.' },
        2: { label: 'Fair', desc: 'Air quality is acceptable.' },
        3: { label: 'Moderate', desc: 'Sensitive groups may experience health effects.' },
        4: { label: 'Poor', desc: 'Everyone may begin to experience health effects.' },
        5: { label: 'Very Poor', desc: 'Health warnings of emergency conditions.' }
      };
      
      const realAqi = calcAQI(pm25);
      
      const valAqi = document.getElementById('valAqi');
      if (valAqi) {
        valAqi.dataset.target = realAqi;
        animateCounter(valAqi, realAqi, '');
      }
      
      const unitAqi = document.getElementById('unitAqi');
      if (unitAqi) unitAqi.textContent = aqiMap[aqi].label;
      
      const trendAqi = document.getElementById('trendAqi');
      if (trendAqi) trendAqi.textContent = aqiMap[aqi].desc;
      
      const cardAqi = document.getElementById('cardAqi');
      if (cardAqi) {
        cardAqi.className = 'metric-card';
        if (aqi <= 2) cardAqi.classList.add('aqi-good');
        else if (aqi >= 4) cardAqi.classList.add('aqi-bad');
      }

      const valPm25 = document.getElementById('valPm25');
      if (valPm25) {
        valPm25.dataset.target = pm25;
        animateCounter(valPm25, pm25, ' µg/m³');
      }
      
      const trendPm25 = document.getElementById('trendPm25');
      if (trendPm25) trendPm25.textContent = `CO: ${currentData.list[0].components.co} µg/m³ | NO2: ${currentData.list[0].components.no2}`;
    }
    
    // Process forecast data
    if (forecastData.list && forecastData.list.length > 0) {
      const tomorrowList = forecastData.list.filter(item => {
        const itemDate = new Date(item.dt * 1000);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return itemDate.getDate() === tomorrow.getDate();
      });
      
      if (tomorrowList.length > 0) {
        const avgPm25 = tomorrowList.reduce((acc, curr) => acc + curr.components.pm2_5, 0) / tomorrowList.length;
        const tomorrowAqi = calcAQI(avgPm25);
        const badge = document.getElementById('forecastBadge');
        if (badge) badge.textContent = `AQI ${tomorrowAqi}`;
        
        let desc = "Good — Safe for all activities.";
        if (tomorrowAqi > 50) desc = "Moderate — Sensitive groups take care.";
        if (tomorrowAqi > 100) desc = "Unhealthy for Sensitive Groups.";
        if (tomorrowAqi > 150) desc = "Unhealthy — Avoid prolonged outdoor exertion.";
        
        const forecastDesc = document.getElementById('forecastDesc');
        if (forecastDesc) forecastDesc.textContent = desc;
      }
      
      const dailyMap = {};
      forecastData.list.forEach(item => {
        const dateStr = new Date(item.dt * 1000).toLocaleDateString('en-US', {weekday: 'short'});
        if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
        dailyMap[dateStr].push(calcAQI(item.components.pm2_5));
      });
      
      const labels = Object.keys(dailyMap).slice(0, 5);
      const dataPoints = labels.map(label => Math.round(dailyMap[label].reduce((a, b) => a + b, 0) / dailyMap[label].length));
      
      if (window.aqiChartInstance) {
        window.aqiChartInstance.data.labels = labels;
        window.aqiChartInstance.data.datasets[0].data = dataPoints;
        window.aqiChartInstance.update();
      }
      
      drawSparkline('sparkAqi', dataPoints);
      
      const pmSparkData = labels.map(label => {
        const dayItems = forecastData.list.filter(item => new Date(item.dt * 1000).toLocaleDateString('en-US', {weekday: 'short'}) === label);
        return Math.round(dayItems.reduce((a, b) => a + b.components.pm2_5, 0) / dayItems.length);
      });
      drawSparkline('sparkPm', pmSparkData);
    }
    
  } catch(err) {
    console.error("Air pollution fetch error:", err);
  }
}

// ── Init on DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  initParticles('particlesBg');
  // Stagger reveal animations
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.08}s`;
  });

  const weatherForm = document.getElementById('weatherSearchForm');
  const cityInput = document.getElementById('weatherCityInput');
  if(weatherForm && cityInput) {
    weatherForm.addEventListener('submit', (e) => {
      e.preventDefault();
      fetchWeather(cityInput.value);
    });
    // Initial fetch
    fetchWeather(cityInput.value);
  }
});

// ── Sign Out ──
function signOut() {
  window.location.href = 'auth.html';
}

console.log('🌿 Air Vision Dashboard loaded');
