import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getDiningApp, getDiningDb } from "@/lib/firebase/diningApp";
import type { FirebaseClientConfig } from "@/lib/config/types";

export interface UserFirebase {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
  isPersonal: boolean;
}

const personalAppName = (uid: string) => `uw-fuel-personal-${uid}`;

function initPersonalApp(uid: string, cfg: FirebaseClientConfig): FirebaseApp {
  const name = personalAppName(uid);
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return initializeApp(
    {
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      databaseURL: cfg.databaseURL,
      projectId: cfg.projectId,
      appId: cfg.appId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
    },
    name,
  );
}

export function getSharedAuth(): Auth {
  return getAuth(getDiningApp());
}

export function getUserFirebase(
  uid: string,
  firebase: FirebaseClientConfig | null,
): UserFirebase {
  if (firebase?.databaseURL) {
    try {
      const app = initPersonalApp(uid, firebase);
      return {
        app,
        auth: getSharedAuth(), // auth always via shared project
        db: getDatabase(app, firebase.databaseURL),
        isPersonal: true,
      };
    } catch {}
  }

  const app = getDiningApp();
  return {
    app,
    auth: getSharedAuth(),
    db: getDiningDb(),
    isPersonal: false,
  };
}
