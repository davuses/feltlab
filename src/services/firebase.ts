import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { DrillAttemptRecord, MasterySummary, UserPreferences } from '../poker/types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function sanitizeDisplayName(raw: string | null | undefined): string {
  const cleaned = (raw ?? 'Player').trim().slice(0, 64);
  return cleaned.length > 0 ? cleaned : 'Player';
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `att_${Date.now()}`;
}

export async function loadOrCreateCloudProfile(
  user: User,
  fallbackSummary: MasterySummary,
  fallbackPrefs: UserPreferences
): Promise<{
  summary: MasterySummary;
  prefs: UserPreferences;
  attempts: DrillAttemptRecord[];
}> {
  const profilePath = `users/${user.uid}`;
  const profileRef = doc(db, 'users', user.uid);

  let summary = fallbackSummary;
  let prefs = fallbackPrefs;

  try {
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const data = snap.data();
      summary = {
        totalDecisions: Number(data.totalDecisions ?? 0),
        optimalCount: Number(data.optimalCount ?? 0),
        totalEvLossBb: Number(data.totalEvLossBb ?? 0),
        currentStreak: Number(data.currentStreak ?? 0),
        bestStreak: Number(data.bestStreak ?? 0),
      };
      prefs = {
        fourColorDeck: Boolean(data.fourColorDeck ?? true),
        soundEnabled: Boolean(data.soundEnabled ?? true),
      };
    } else {
      await setDoc(profileRef, {
        uid: user.uid,
        displayName: sanitizeDisplayName(user.displayName),
        fourColorDeck: fallbackPrefs.fourColorDeck,
        soundEnabled: fallbackPrefs.soundEnabled,
        totalDecisions: Math.max(0, Math.round(fallbackSummary.totalDecisions)),
        optimalCount: Math.max(
          0,
          Math.min(
            Math.round(fallbackSummary.optimalCount),
            Math.round(fallbackSummary.totalDecisions)
          )
        ),
        totalEvLossBb: Math.max(0, Number(fallbackSummary.totalEvLossBb.toFixed(2))),
        currentStreak: Math.max(0, Math.round(fallbackSummary.currentStreak)),
        bestStreak: Math.max(
          Math.round(fallbackSummary.currentStreak),
          Math.round(fallbackSummary.bestStreak)
        ),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  const attemptsPath = `users/${user.uid}/attempts`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'attempts'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(120)
    );
    const snap = await getDocs(q);
    const attempts: DrillAttemptRecord[] = snap.docs.map((d) => {
      const data = d.data();
      const ts =
        data.createdAt && typeof data.createdAt.toMillis === 'function'
          ? data.createdAt.toMillis()
          : Date.now();
      return {
        id: d.id,
        module: data.module,
        position: data.position,
        street: data.street,
        spotLabel: data.spotLabel,
        chosenAction: data.chosenAction,
        bestAction: data.bestAction,
        evLossBb: Number(data.evLossBb ?? 0),
        grade: data.grade,
        accuracyScore: Number(data.accuracyScore ?? 0),
        timestamp: ts,
      };
    });
    return { summary, prefs, attempts };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, attemptsPath);
  }
}

export async function persistCloudAttemptAndSummary(
  user: User,
  attempt: DrillAttemptRecord,
  summary: MasterySummary,
  prefs: UserPreferences
): Promise<void> {
  const attemptId = sanitizeId(attempt.id);
  const attemptPath = `users/${user.uid}/attempts/${attemptId}`;
  const profilePath = `users/${user.uid}`;

  try {
    await setDoc(doc(db, 'users', user.uid, 'attempts', attemptId), {
      uid: user.uid,
      module: attempt.module,
      position: attempt.position,
      street: attempt.street,
      spotLabel: attempt.spotLabel.slice(0, 120),
      chosenAction: attempt.chosenAction.slice(0, 64),
      bestAction: attempt.bestAction.slice(0, 64),
      evLossBb: Math.max(0, Math.min(200, Number(attempt.evLossBb.toFixed(2)))),
      grade: attempt.grade,
      accuracyScore: Math.max(0, Math.min(100, Math.round(attempt.accuracyScore))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, attemptPath);
  }

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: sanitizeDisplayName(user.displayName),
      fourColorDeck: prefs.fourColorDeck,
      soundEnabled: prefs.soundEnabled,
      totalDecisions: Math.max(0, Math.round(summary.totalDecisions)),
      optimalCount: Math.max(
        0,
        Math.min(Math.round(summary.optimalCount), Math.round(summary.totalDecisions))
      ),
      totalEvLossBb: Math.max(0, Number(summary.totalEvLossBb.toFixed(2))),
      currentStreak: Math.max(0, Math.round(summary.currentStreak)),
      bestStreak: Math.max(
        Math.round(summary.currentStreak),
        Math.round(summary.bestStreak)
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export async function persistCloudPreferences(
  user: User,
  prefs: UserPreferences
): Promise<void> {
  const profilePath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: sanitizeDisplayName(user.displayName),
      fourColorDeck: prefs.fourColorDeck,
      soundEnabled: prefs.soundEnabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export async function clearCloudHistory(user: User): Promise<void> {
  const attemptsPath = `users/${user.uid}/attempts`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'attempts'),
      where('uid', '==', user.uid),
      limit(150)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, attemptsPath);
  }

  const profilePath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      totalDecisions: 0,
      optimalCount: 0,
      totalEvLossBb: 0,
      currentStreak: 0,
      bestStreak: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export async function deleteSingleCloudAttempt(user: User, attemptId: string): Promise<void> {
  const path = `users/${user.uid}/attempts/${attemptId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'attempts', attemptId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
