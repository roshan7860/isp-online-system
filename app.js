import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, query, where,
  serverTimestamp, doc, updateDoc, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
