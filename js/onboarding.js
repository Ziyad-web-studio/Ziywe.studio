import { auth, db, doc, getDoc, setDoc, onAuthStateChanged } from "./firebase.js";

const onboardingSection = document.getElementById('onboarding-section');
const dashboardSection = document.getElementById('dashboard-section');
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

let currentUser = null;
let step = 0; // 0: Name, 1: Category
let onboardingData = {
  storeName: "",
  storeCategory: ""
};

// Listen for auth state to start checks
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await checkProfile(user.uid);
  }
});

async function checkProfile(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // User exists, show dashboard
      showDashboard(docSnap.data());
    } else {
      // User new, show onboarding
      startOnboarding();
    }
  } catch (error) {
    console.error("Error checking profile:", error);
  }
}

function showDashboard(data) {
  onboardingSection.classList.add('hidden');
  onboardingSection.style.display = 'none'; // Ensure it's hidden
  dashboardSection.classList.remove('hidden');

  // Update dashboard details
  if (data) {
    document.getElementById('store-name-display').textContent = data.storeName || "Toko Saya";
    document.getElementById('store-type-display').textContent = data.storeCategory || "Usaha Umum";
  }

  // Dispatch event for dashboard.js to know it's ready
  window.dispatchEvent(new Event('dashboardReady'));
}

function startOnboarding() {
  dashboardSection.classList.add('hidden');
  onboardingSection.classList.remove('hidden');
  onboardingSection.style.display = 'flex'; // Restore flex for layout

  addBotMessage("Halo! Nama tokomu apa?");
  step = 0;
}

function addBotMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-bubble bot';
  div.textContent = text;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-bubble user';
  div.textContent = text;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Validation
  if (text.length < 2) {
    addBotMessage("Isi singkat aja ya (min 2 huruf).");
    return;
  }

  addUserMessage(text);
  chatInput.value = "";

  if (step === 0) {
    onboardingData.storeName = text;
    step = 1;
    setTimeout(() => addBotMessage("Oke! Jualan apa?"), 500);
  } else if (step === 1) {
    onboardingData.storeCategory = text;
    step = 2; // Finished
    setTimeout(() => addBotMessage("Sip, data disimpan..."), 500);
    await saveProfile();
  }
}

async function saveProfile() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      storeName: onboardingData.storeName,
      storeCategory: onboardingData.storeCategory,
      createdAt: new Date()
    });
    setTimeout(() => showDashboard(onboardingData), 1000);
  } catch (error) {
    console.error("Error saving profile:", error);
    addBotMessage("Yah, gagal nyimpen. Coba lagi ya.");
  }
}

// Event Listeners
chatSend.addEventListener('click', handleSend);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSend();
});
