
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, Timestamp, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// FIX: Monkey-patch the Firebase Timestamp object to make it serializable.
// This prevents "Converting circular structure to JSON" errors when stringifying
// state that contains Firestore Timestamps.
if (!(Timestamp.prototype as any).toJSON) {
  (Timestamp.prototype as any).toJSON = function() {
    return this.toDate().toISOString();
  };
}

const firebaseConfig = {
  apiKey: "AIzaSyCB7ZTAhDlRwueGW6jqDdMqmpfHOI62mtE",
  authDomain: "mintleaf-74d27.firebaseapp.com",
  projectId: "mintleaf-74d27",
  storageBucket: "mintleaf-74d27.appspot.com",
  messagingSenderId: "1053273095803",
  appId: "1:1053273095803:web:84670303a5324c0d816cde",
  measurementId: "G-2Y86CZ0633"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { Timestamp, serverTimestamp };
