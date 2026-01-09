import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Replace this with YOUR Firebase config from Step 3 above!
const firebaseConfig = {
  apiKey: "AIzaSyCIDSad6XvEsjpCb7hrqduSrMA07jd74ec",
  authDomain: "fortnite-tournament-84fc6.firebaseapp.com",
  projectId: "fortnite-tournament-84fc6",
  storageBucket: "fortnite-tournament-84fc6.firebasestorage.app",
  messagingSenderId: "347186297636",
  appId: "1:347186297636:web:8d98b495e698bce422d1b1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);