import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCF0pNQ0nXPq3_lhcLq-vMNKDdLwy20h-E",
  authDomain: "yard-sale-tracker.firebaseapp.com",
  projectId: "yard-sale-tracker",
  storageBucket: "yard-sale-tracker.firebasestorage.app",
  messagingSenderId: "401959838172",
  appId: "1:401959838172:web:9190f35526e128e6382f19",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
