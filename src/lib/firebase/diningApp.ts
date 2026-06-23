import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const DINING_APP_NAME = "uwfuel-dining";

const diningConfig = {
  apiKey: process.env.NEXT_PUBLIC_DINING_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_DINING_AUTH_DOMAIN!,
  databaseURL: process.env.NEXT_PUBLIC_DINING_DB_URL!,
  projectId: process.env.NEXT_PUBLIC_DINING_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_DINING_APP_ID!,
};

let _diningApp: FirebaseApp | null = null;
let _diningDb: Database | null = null;

export function getDiningApp(): FirebaseApp {
  if (_diningApp) return _diningApp;
  _diningApp =
    getApps().find((a) => a.name === DINING_APP_NAME) ??
    initializeApp(diningConfig, DINING_APP_NAME);
  return _diningApp;
}

export function getDiningDb(): Database {
  if (_diningDb) return _diningDb;
  _diningDb = getDatabase(getDiningApp());
  return _diningDb;
}
