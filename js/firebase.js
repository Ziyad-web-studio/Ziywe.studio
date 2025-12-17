// Firebase Configuration (Placeholders)
// NOTE: Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAy24bhSoGwGCmZuvpqjvZrR9USS0eN2w0",
  authDomain: "elibase-bookstore.firebaseapp.com",
  projectId: "elibase-bookstore",
  storageBucket: "elibase-bookstore.firebasestorage.app",
  messagingSenderId: "345796389174",
  appId: "1:345796389174:web:fe6fb0aed2dff2f1d7eb97",
  measurementId: "G-7J4W76GZQC"
};
// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc };
