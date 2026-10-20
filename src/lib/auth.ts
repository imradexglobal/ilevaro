import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { auth } from "./firebase";

type FirebaseUser = firebase.User;

export async function signUp(email: string, password: string, displayName: string) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  if (cred.user) {
    await cred.user.updateProfile({ displayName });
  }
  return cred.user;
}

export async function signIn(email: string, password: string) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

export async function signOut() {
  await auth.signOut();
}

export async function resetPassword(email: string) {
  await auth.sendPasswordResetEmail(email);
}

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
  return auth.onAuthStateChanged(callback);
}

export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}