import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    normalizeLocalSession,
    parseLocalSession,
} from "./localSessionState.js";

const LOCAL_SESSION_KEY = "expo_chess_local_session_v1";

export async function saveLocalSession(sessionData) {
    const normalized = normalizeLocalSession(
        sessionData,
        new Date().toISOString(),
    );
    await AsyncStorage.setItem(
        LOCAL_SESSION_KEY,
        JSON.stringify(normalized),
    );
}

export async function loadLocalSession() {
    const raw = await AsyncStorage.getItem(LOCAL_SESSION_KEY);
    return parseLocalSession(raw);
}

export async function clearLocalSession() {
    await AsyncStorage.removeItem(LOCAL_SESSION_KEY);
}
