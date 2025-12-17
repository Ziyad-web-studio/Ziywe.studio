import { logout } from "./auth.js";

// Day/Night Logic
// Day: 05:00 - 18:00
// Night: 18:01 - 04:59

function updateTheme() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Calculate minutes from start of day for easier comparison
  const currentMinutes = hour * 60 + minute;

  const dayStart = 5 * 60; // 05:00
  const dayEnd = 18 * 60;  // 18:00

  // Logic:
  // If current time is >= 05:00 AND <= 18:00 -> Day
  // Else -> Night

  const isDay = currentMinutes >= dayStart && currentMinutes <= dayEnd;

  if (isDay) {
    document.body.classList.remove('night-mode');
  } else {
    document.body.classList.add('night-mode');
  }
}

// Update Greeting based on time
function updateGreeting() {
  const greetingEl = document.getElementById('greeting');
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let text = "Selamat Pagi";

  if (hour >= 5 && hour < 11) text = "Selamat Pagi";
  else if (hour >= 11 && hour < 15) text = "Selamat Siang";
  else if (hour >= 15 && hour < 18) text = "Selamat Sore";
  else text = "Selamat Malam";

  greetingEl.textContent = text;
}

// Initial Run
updateTheme();
// Check every minute
setInterval(updateTheme, 60000);

// Listen for dashboard ready event (fired by onboarding.js)
window.addEventListener('dashboardReady', () => {
  updateGreeting();
});

// Also try to update greeting if elements exist directly (refresh case)
if (document.getElementById('greeting')) {
    updateGreeting();
}

// Logout Handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await logout();
  });
}
