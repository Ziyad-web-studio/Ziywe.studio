import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔥 FIREBASE CONFIG – ISI DARI FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyAy24bhSoGwGCmZuvpqjvZrR9USS0eN2w0",
  authDomain: "elibase-bookstore.firebaseapp.com",
  projectId: "elibase-bookstore",
  storageBucket: "elibase-bookstore.firebasestorage.app",
  messagingSenderId: "345796389174",
  appId: "1:345796389174:web:fe6fb0aed2dff2f1d7eb97",
  measurementId: "G-7J4W76GZQC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();