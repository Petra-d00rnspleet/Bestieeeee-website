
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getDatabase
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB_gIvmh07gYLw6kbb9-EWaxm_MnDavfmA",
  authDomain: "bestelwebsitenl.firebaseapp.com",
  databaseURL: "https://bestelwebsitenl-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bestelwebsitenl",
  storageBucket: "bestelwebsitenl.firebasestorage.app",
  messagingSenderId: "298628785707",
  appId: "1:298628785707:web:fad0248548d7a371e1ec6e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export const persistenceReady = setPersistence(
  auth,
  browserLocalPersistence
);
