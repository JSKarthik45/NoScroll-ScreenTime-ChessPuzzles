import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import Constants from 'expo-constants';

// LargeSecureStore: stores an AES-256 key in SecureStore and ciphertext in AsyncStorage
class LargeSecureStore {
	async _encrypt(key, value) {
		const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
		const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
		const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(String(value)));
		await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
		return aesjs.utils.hex.fromBytes(encryptedBytes);
	}

	async _decrypt(key, value) {
		const encryptionKeyHex = await SecureStore.getItemAsync(key);
		if (!encryptionKeyHex) return encryptionKeyHex;
		const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
		const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
		return aesjs.utils.utf8.fromBytes(decryptedBytes);
	}

	async getItem(key) {
		const encrypted = await AsyncStorage.getItem(key);
		if (!encrypted) return encrypted;
		return this._decrypt(key, encrypted);
	}

	async removeItem(key) {
		await AsyncStorage.removeItem(key);
		await SecureStore.deleteItemAsync(key);
	}

	async setItem(key, value) {
		const encrypted = await this._encrypt(key, value);
		await AsyncStorage.setItem(key, encrypted);
	}
}

// Read Supabase credentials from Expo extra (supports extra and extra.eas)
function resolveExtra() {
	const configExtra = Constants?.expoConfig?.extra || {};
	const manifestExtra = Constants?.manifest?.extra || {};
	const merge = (a, b) => ({ ...a, ...b });
	const flat = merge({}, merge(configExtra, manifestExtra));
	// If values were nested under extra.eas (common when set via EAS), flatten them
	const flatEas = merge({}, merge(configExtra.eas || {}, manifestExtra.eas || {}));
	return { ...flat, ...flatEas };
}

const extra = resolveExtra();
const SUPABASE_URL = extra?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = extra?.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		storage: new LargeSecureStore(),
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});

