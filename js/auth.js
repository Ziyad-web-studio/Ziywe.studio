import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase.js";

// Helper to determine current page
const getPage = () => {
  const path = window.location.pathname;
  if (path.endsWith("index.html") || path === "/") return "index";
  if (path.endsWith("login.html")) return "login";
  if (path.endsWith("app.html")) return "app";
  return "unknown";
};

// Auth Guard & Redirect Logic
onAuthStateChanged(auth, (user) => {
  const page = getPage();
  console.log(`Auth state changed: ${user ? "Logged In" : "Logged Out"}, Page: ${page}`);

  if (user) {
    // User is logged in
    if (page === "index" || page === "login") {
      window.location.href = "app.html";
    }
  } else {
    // User is logged out
    if (page === "app") {
      window.location.href = "login.html";
    }
  }
});

// Login with Google
const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Login Error:", error);
    throw error;
  }
};

// Login with Email
const loginWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Email Login Error:", error);
    throw error;
  }
};

// Register with Email
const registerWithEmail = async (email, password) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Registration Error:", error);
    throw error;
  }
};

// Logout
const logout = async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
};

export { loginWithGoogle, loginWithEmail, registerWithEmail, logout };
