const firebase = require("firebase/compat/app");
require("firebase/compat/auth");
require("firebase/compat/firestore");

firebase.initializeApp({
  apiKey: "AIzaSyFAKEKEYFAKEKEYFAKEKEYFAKEKEYFA",
  authDomain: "ilevaro.firebaseapp.com",
  projectId: "ilevaro",
  appId: "1:1234567890:web:abcdef",
});

try {
  const auth = firebase.auth();
  console.log("[OK] firebase.auth() succeeded:", typeof auth);
} catch (e) {
  console.log("[FAIL] firebase.auth() threw:", e.message);
  process.exit(1);
}

try {
  const db = firebase.firestore();
  console.log("[OK] firebase.firestore() succeeded:", typeof db);
} catch (e) {
  console.log("[FAIL] firebase.firestore() threw:", e.message);
  process.exit(1);
}
console.log("[PASS] auth + firestore components registered");
