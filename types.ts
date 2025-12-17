export interface UserProfile {
  uid: string;
  email: string | null;
  shopName?: string;
  shopCategory?: string;
  onboardingComplete: boolean;
}

export interface Transaction {
  id?: string;
  userId: string;
  itemName: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: any; // Firebase Timestamp
  originalInput: string;
}

export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD'
}

export enum DayMode {
  DAY = 'DAY', // 05:00 - 18:00
  NIGHT = 'NIGHT' // 18:01 - 04:59
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
