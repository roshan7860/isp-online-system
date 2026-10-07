// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDXJzoR84ruPY8Be_-j3WhsfPrwEvlBGPo",
  authDomain: "my-customer-9c556.firebaseapp.com",
  projectId: "my-customer-9c556",
  storageBucket: "my-customer-9c556.firebasestorage.app",
  messagingSenderId: "831115750906",
  appId: "1:831115750906:web:3cb513eda1399eb66b8843",
  measurementId: "G-5X49QLRWTN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
