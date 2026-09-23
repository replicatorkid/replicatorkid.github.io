/*
 * manager_4.js
 *
 * Memory + queue management for the Suregain Hunter page set.
 *
 * Design principles:
 * - There is one current state object in memory.
 * - That state is saved to localStorage.
 * - The queue is an array of copies of the current state.
 * - Each queued copy is an event snapshot.
 * - A queue item is distinguished by the event slots:
 *       eventId
 *       eventTimestamp
 *       eventType
 * - Slot names are simple strings. If a name begins with "!", it is
 *   squeaky and triggers queueEvent("slot_changed").
 * - Structural data are just hard slots, and they are also set through
 *   setSlot().
 */

const Manager = (function () {
    "use strict";

    const STORAGE_PREFIX = "sgh";
    const HARD_SLOTS = new Set([
        "huntName",
        "huntVersion",
        "sessionId",
        "startTimestamp",
        "playerName",
        "eventId",
        "eventTimestamp",
        "eventType",
        "status"
    ]);

    let state = null;
    let queue = [];

    function sanitizeString(value, fieldName) {
        if (typeof value !== "string") {
            throw new Error(`The ${fieldName} must be a string.`);
        }

        const trimmed = value.trim();

        if (trimmed === "") {
            throw new Error(`The ${fieldName} cannot be empty.`);
        }

        return trimmed;
    }

    function cleanSlotName(name) {
        if (name === undefined || name === null) {
            throw new Error("Slot name is required.");
        }

        const cleaned = String(name).trim();

        if (cleaned === "") {
            throw new Error("Slot name cannot be empty.");
        }

        return cleaned;
    }

    function isSqueakySlotName(name) {
        return String(name).startsWith("!");
    }

    function getStateStorageKey(huntName, huntVersion) {
        return `${STORAGE_PREFIX}:${sanitizeString(String(huntName), "hunt name")}:${String(huntVersion)}:state`;
    }

    function getQueueStorageKey(huntName, huntVersion) {
        return `${STORAGE_PREFIX}:${sanitizeString(String(huntName), "hunt name")}:${String(huntVersion)}:queue`;
    }

    function generateId() {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).substring(2, 10)
        );
    }

    function cloneStateForQueue() {
        return JSON.parse(JSON.stringify(state));
    }

    function requireState() {
        if (state === null) {
            throw new Error("No active session is loaded. Call Manager.startSession() or Manager.initialize() first.");
        }
    }

    function saveState() {
        if (state === null) {
            throw new Error("Cannot save: there is no active state.");
        }

        const key = getStateStorageKey(state.huntName, state.huntVersion);
        localStorage.setItem(key, JSON.stringify(state));
    }

    function loadState(huntName, huntVersion) {
        const key = getStateStorageKey(huntName, huntVersion);
        const stored = localStorage.getItem(key);

        if (stored === null) {
            return null;
        }

        try {
            const parsed = JSON.parse(stored);

            if (parsed === null || typeof parsed !== "object") {
                throw new Error("The saved state was invalid.");
            }

            return parsed;
        }
        catch (error) {
            throw new Error("The saved state could not be read.");
        }
    }

    function saveQueue() {
        if (state === null) {
            throw new Error("Cannot save queue: there is no active state.");
        }

        const key = getQueueStorageKey(state.huntName, state.huntVersion);
        localStorage.setItem(key, JSON.stringify(queue));
    }

    function loadQueue(huntName, huntVersion) {
        const key = getQueueStorageKey(huntName, huntVersion);
        const stored = localStorage.getItem(key);

        if (stored === null) {
            return [];
        }

        try {
            const parsed = JSON.parse(stored);

            if (!Array.isArray(parsed)) {
                throw new Error("The saved queue was invalid.");
            }

            return parsed;
        }
        catch (error) {
            throw new Error("The saved queue could not be read.");
        }
    }

    function queueEvent(eventType) {
        requireState();

        if (typeof eventType !== "string" || eventType.trim() === "") {
            throw new Error("Event type is required.");
        }

        state.eventId = generateId();
        state.eventTimestamp = new Date().toISOString();
        state.eventType = eventType.trim();

        queue.push(cloneStateForQueue());
        saveQueue();
        saveState();

        return state.eventId;
    }

    function readState() {
        requireState();
        return JSON.parse(JSON.stringify(state));
    }

    function startSession(huntName, huntVersion, playerName) {
        const cleanHuntName = sanitizeString(String(huntName), "hunt name");
        const cleanVersion = Number(huntVersion);
        const cleanPlayerName = sanitizeString(String(playerName), "player name");

        if (!Number.isInteger(cleanVersion) || cleanVersion < 1) {
            throw new Error("Hunt version must be a positive integer.");
        }

        if (loadState(cleanHuntName, cleanVersion) !== null) {
            throw new Error(`A saved state already exists for hunt "${cleanHuntName}" version ${cleanVersion}.`);
        }

        state = {
            huntName: cleanHuntName,
            huntVersion: cleanVersion,
            sessionId: generateId(),
            startTimestamp: new Date().toISOString(),
            playerName: cleanPlayerName,
            eventId: "",
            eventTimestamp: "",
            eventType: "",
            status: "active"
        };

        queue = [];
        saveState();
        queueEvent("session_started");

        return readState();
    }

    function initialize(huntName, huntVersion) {
        const cleanHuntName = sanitizeString(String(huntName), "hunt name");
        const cleanVersion = Number(huntVersion);

        if (!Number.isInteger(cleanVersion) || cleanVersion < 1) {
            throw new Error("Hunt version must be a positive integer.");
        }

        const loadedState = loadState(cleanHuntName, cleanVersion);

        if (loadedState === null) {
            state = null;
            queue = [];
            return null;
        }

        state = loadedState;
        queue = loadQueue(cleanHuntName, cleanVersion);
        return readState();
    }

    function hasState(huntName, huntVersion) {
        try {
            return loadState(huntName, huntVersion) !== null;
        }
        catch (error) {
            return false;
        }
    }

    function resetSession() {
        requireState();

        const key = getStateStorageKey(state.huntName, state.huntVersion);
        const queueKey = getQueueStorageKey(state.huntName, state.huntVersion);

        localStorage.removeItem(key);
        localStorage.removeItem(queueKey);

        state = null;
        queue = [];

        return true;
    }

    function slotExists(name) {
        requireState();

        const cleaned = cleanSlotName(name);

        if (HARD_SLOTS.has(cleaned)) {
            return true;
        }

        return Object.prototype.hasOwnProperty.call(state, cleaned);
    }

    function createSlot(name, content = "") {
        requireState();

        const cleaned = cleanSlotName(name);

        if (HARD_SLOTS.has(cleaned)) {
            throw new Error(`The slot name "${cleaned}" is reserved for hard state data.`);
        }

        if (!Object.prototype.hasOwnProperty.call(state, cleaned)) {
            state[cleaned] = content;
            saveState();
        }

        return cleaned;
    }

    function readSlot(name) {
        requireState();

        const cleaned = cleanSlotName(name);

        if (!Object.prototype.hasOwnProperty.call(state, cleaned)) {
            return null;
        }

        return state[cleaned];
    }

    function setSlot(name, value) {
        requireState();

        const cleaned = cleanSlotName(name);

        if (HARD_SLOTS.has(cleaned)) {
            const previousValue = state[cleaned];

            if (previousValue === value) {
                return value;
            }

            state[cleaned] = value;
            saveState();
            queueEvent("slot_changed");

            return value;
        }

        if (!Object.prototype.hasOwnProperty.call(state, cleaned)) {
            throw new Error(`The slot "${cleaned}" does not exist.`);
        }

        const previousValue = state[cleaned];

        if (previousValue === value) {
            return value;
        }

        state[cleaned] = value;
        saveState();

        if (isSqueakySlotName(cleaned)) {
            queueEvent("slot_changed");
        }

        return value;
    }

    return {
        startSession,
        initialize,
        hasState,
        resetSession,
        queueEvent,
        readState,
        slotExists,
        createSlot,
        readSlot,
        setSlot,
        isSqueakySlotName,
        getStateStorageKey,
        getQueueStorageKey,
        generateId,
        loadState,
        loadQueue,
        saveState,
        saveQueue
    };
})();
