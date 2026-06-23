export interface UWFuelConfig {
  cohereKey: string | null;
  firebase: FirebaseClientConfig | null;
}

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}
