const CLIENT_PROFILE_KEY = "expo_chess_client_profile_id_v1";
let cachedClientInstanceId = null;
let cachedClientProfileId = null;
const runtimeTabId = generateClientInstanceId();

function generateClientInstanceId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    const random = Math.random().toString(36).slice(2, 10);
    return `client_${Date.now().toString(36)}_${random}`;
}

export function getClientInstanceId() {
    if (cachedClientInstanceId) {
        return cachedClientInstanceId;
    }

    const profileId = getClientProfileId();
    cachedClientInstanceId = `${profileId}:${runtimeTabId}`;
    return cachedClientInstanceId;
}

function getClientProfileId() {
    if (cachedClientProfileId) {
        return cachedClientProfileId;
    }

    try {
        if (typeof localStorage !== "undefined") {
            const existing = localStorage.getItem(CLIENT_PROFILE_KEY);
            if (existing) {
                cachedClientProfileId = existing;
                return cachedClientProfileId;
            }

            const created = generateClientInstanceId();
            localStorage.setItem(CLIENT_PROFILE_KEY, created);
            cachedClientProfileId = created;
            return cachedClientProfileId;
        }
    } catch {
        // Ignore storage errors and fallback to in-memory instance.
    }

    cachedClientProfileId = generateClientInstanceId();
    return cachedClientProfileId;
}
