import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Web doesn't support expo-secure-store; fall back to localStorage.
const webFallback = {
  getItem: async (k: string) =>
    typeof window !== 'undefined' ? window.localStorage.getItem(k) : null,
  setItem: async (k: string, v: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(k, v);
  },
  deleteItem: async (k: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(k);
  },
};

export const secureStorage = Platform.OS === 'web'
  ? webFallback
  : {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
      deleteItem: SecureStore.deleteItemAsync,
    };
