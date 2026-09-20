/*
 * manager_2.js
 *
 * Flat state manager for browser-based treasure hunts.
 *
 * This version intentionally avoids nested slot objects. The state is a
 * flat object keyed by slot name, and squeaky slots are identified by a
 * leading "!" in the name.
 *
 * Examples:
 *   Manager2.setSlot("alpha.1", "note");
 *   Manager2.setSlot("!alpha.finalAnswer", "answer");
 *
 * The public interface is intentionally similar to the original manager.js,
 * but the underlying storage format is flatter and closer to the eventual
 * D1 table structure.
 */

const Manager2 = (function () {

    // ============================================================
    // SETTINGS
    // ============================================================

    const SCHEMA_VERSION = 2;

    let gameState = null;

    const RESERVED_KEYS = new Set([
        "schemaVersion",
        "version",
        "huntName",
        "sessionId",
        "startedAt",
        "hunterName",
        "status"
    ]);

    // ============================================================
    // INTERNAL STORAGE FUNCTIONS
    // ============================================================

    function getCurrentHuntName() {

        const path = window.location.pathname;

        if (!path || path === "/") {
            return "";
        }

        const segments = path.split("/").filter(Boolean);

        if (segments.length === 0) {
            return "";
        }

        const lastSegment = segments[segments.length - 1];

        if (lastSegment.includes(".")) {
            return segments[segments.length - 2] || "";
        }

        return lastSegment;
    }

    function getStorageKey(huntName) {
        return `hunt:${huntName}:state`;
    }

    function getEventStorageKey(huntName) {
        return `hunt:${huntName}:events`;
    }

    function normalizeSlotName(name) {

        if (typeof name !== "string") {
            throw new Error("Cannot use a slot name that is not a string.");
        }

        const trimmed = name.trim();

        if (trimmed === "") {
            throw new Error("Cannot use an empty slot name.");
        }

        return trimmed;
    }

    function isSqueakySlotName(name) {
        return normalizeSlotName(name).startsWith("!");
    }

    function createSqueakyVersion(name) {
        const normalized = normalizeSlotName(name);

        if (normalized.startsWith("!")) {
            return normalized;
        }

        return `!${normalized}`;
    }

    function resolveSlotReference(name) {

        const normalized = normalizeSlotName(name);

        if (Object.prototype.hasOwnProperty.call(gameState, normalized)) {
            return normalized;
        }

        const squeakyVersion = createSqueakyVersion(normalized);

        if (Object.prototype.hasOwnProperty.call(gameState, squeakyVersion)) {
            return squeakyVersion;
        }

        return normalized;
    }

    function saveState() {

        if (gameState === null) {
            throw new Error("Cannot save: no game state exists.");
        }

        const key = getStorageKey(gameState.huntName);

        localStorage.setItem(
            key,
            JSON.stringify(gameState)
        );
    }

    function loadState(huntName) {

        const key = getStorageKey(huntName);
        const stored = localStorage.getItem(key);

        if (stored === null) {
            return null;
        }

        try {
            return JSON.parse(stored);
        }
        catch (error) {
            throw new Error("The saved game state could not be read.");
        }
    }

    function loadEvents(huntName) {

        const key = getEventStorageKey(huntName);
        const stored = localStorage.getItem(key);

        if (stored === null) {
            return [];
        }

        try {
            const parsed = JSON.parse(stored);

            if (!Array.isArray(parsed)) {
                throw new Error("The saved event queue is not valid.");
            }

            return parsed;
        }
        catch (error) {
            throw new Error("The saved event queue could not be read.");
        }
    }

    function saveEvents(huntName, events) {
        localStorage.setItem(
            getEventStorageKey(huntName),
            JSON.stringify(events)
        );
    }

    function generateEventId() {

        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).substring(2, 10)
        );
    }

    function generateSessionId() {

        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).substring(2, 10)
        );
    }

    function queueEvent(eventType, details = {}) {

        if (typeof eventType !== "string" || eventType.trim() === "") {
            throw new Error("Cannot store event: event type is required.");
        }

        const huntName = gameState !== null
            ? gameState.huntName
            : getCurrentHuntName();

        if (!huntName) {
            throw new Error("Cannot store event: the current page URL does not include a hunt name.");
        }

        const events = loadEvents(huntName);

        const event = {
            eventId: generateEventId(),
            eventType: eventType,
            occurredAt: new Date().toISOString(),
            schemaVersion: SCHEMA_VERSION,
            huntName: huntName,
            sessionId: gameState !== null ? gameState.sessionId : null,
            hunterName: gameState !== null ? gameState.hunterName : "",
            status: gameState !== null ? gameState.status : null,
            ...details
        };

        events.push(event);
        saveEvents(huntName, events);

        return event;
    }

    // ============================================================
    // ANALYTICS FOUNDATION
    // ============================================================

    function stateChanged(slotName, oldValue, newValue) {

        queueEvent("slot_changed", {
            slotName: slotName,
            oldValue: oldValue,
            newValue: newValue
        });
    }

    // ============================================================
    // STATE CREATION
    // ============================================================

    function createState(schemaVersion, hunterName = "") {

        const huntName = getCurrentHuntName();

        if (!huntName) {
            throw new Error(
                "Cannot create game state: the current page URL does not include a hunt name."
            );
        }

        if (schemaVersion === undefined || schemaVersion === null) {
            throw new Error(
                "Cannot create game state: schema version is required."
            );
        }

        const existingState = loadState(huntName);

        if (existingState !== null) {
            throw new Error(
                `A game state already exists for "${huntName}". ` +
                `Use Manager2.resetState() if you intentionally want ` +
                `to start over.`
            );
        }

        const sessionId = generateSessionId();

        gameState = {
            schemaVersion: schemaVersion,
            huntName: huntName,
            sessionId: sessionId,
            startedAt: new Date().toISOString(),
            hunterName: hunterName,
            status: "incomplete"
        };

        saveState();

        return getState();
    }

    // ============================================================
    // STATE EXISTENCE / INITIALIZATION
    // ============================================================

    function hasState(huntName = getCurrentHuntName()) {
        return loadState(huntName) !== null;
    }

    function initialize(huntName = getCurrentHuntName()) {

        if (!huntName) {
            throw new Error(
                "Cannot initialize game state: the current page URL does not include a hunt name."
            );
        }

        const state = loadState(huntName);

        if (state === null) {
            throw new Error(
                `No game state exists for "${huntName}".`
            );
        }

        gameState = state;

        return getState();
    }

    // ============================================================
    // EVENTS
    // ============================================================

    function storeEvent(eventType, details = {}) {
        return queueEvent(eventType, details);
    }

    // ============================================================
    // WHOLE STATE
    // ============================================================

    function getState() {

        if (gameState === null) {
            throw new Error("No game state is currently loaded.");
        }

        return JSON.parse(JSON.stringify(gameState));
    }

    // ============================================================
    // STRUCTURAL DATA
    // ============================================================

    function getHunterName() {
        requireState();
        return gameState.hunterName;
    }

    function setHunterName(name) {
        requireState();
        gameState.hunterName = name;
        saveState();
    }

    function getHuntName() {
        requireState();
        return gameState.huntName;
    }

    function getSessionId() {
        requireState();
        return gameState.sessionId;
    }

    function getStartTime() {
        requireState();
        return gameState.startedAt;
    }

    function getStatus() {
        requireState();
        return gameState.status;
    }

    function setStatus(status) {
        requireState();
        gameState.status = status;
        saveState();
    }

    // ============================================================
    // SLOTS
    // ============================================================

    function slotExists(name) {

        requireState();

        const normalized = normalizeSlotName(name);

        if (RESERVED_KEYS.has(normalized)) {
            return false;
        }

        return Object.prototype.hasOwnProperty.call(gameState, normalized);
    }

    function getSlot(name) {

        requireState();

        const normalized = normalizeSlotName(name);

        const resolvedName = resolveSlotReference(normalized);

        if (!Object.prototype.hasOwnProperty.call(gameState, resolvedName)) {
            return null;
        }

        return gameState[resolvedName];
    }

    function setSlot(name, value) {

        requireState();

        const normalized = normalizeSlotName(name);

        if (RESERVED_KEYS.has(normalized)) {
            throw new Error(
                `The slot name "${normalized}" is reserved for game state metadata.`
            );
        }

        const targetName = isSqueakySlotName(normalized)
            ? normalized
            : normalized;

        const oldValue = Object.prototype.hasOwnProperty.call(gameState, targetName)
            ? gameState[targetName]
            : undefined;

        if (oldValue === value) {
            return value;
        }

        gameState[targetName] = value;
        saveState();

        if (isSqueakySlotName(targetName)) {
            stateChanged(targetName, oldValue, value);
        }

        return value;
    }

    // ============================================================
    // SLOT CREATION HELPERS
    // ============================================================

    function createSilentSlot(name) {

        requireState();

        const normalized = normalizeSlotName(name);

        if (RESERVED_KEYS.has(normalized)) {
            throw new Error(
                `The slot name "${normalized}" is reserved for game state metadata.`
            );
        }

        if (!Object.prototype.hasOwnProperty.call(gameState, normalized)) {
            gameState[normalized] = "";
            saveState();
        }

        return normalized;
    }

    function createSqueakySlot(name) {

        requireState();

        const normalized = normalizeSlotName(name);
        const squeakyName = createSqueakyVersion(normalized);

        if (RESERVED_KEYS.has(normalized) || RESERVED_KEYS.has(squeakyName)) {
            throw new Error(
                `The slot name "${normalized}" is reserved for game state metadata.`
            );
        }

        if (!Object.prototype.hasOwnProperty.call(gameState, squeakyName)) {
            gameState[squeakyName] = "";
            saveState();
        }

        return squeakyName;
    }

    // ============================================================
    // RESET
    // ============================================================

    function resetState() {

        requireState();

        const key = getStorageKey(gameState.huntName);
        localStorage.removeItem(key);

        const eventsKey = getEventStorageKey(gameState.huntName);
        localStorage.removeItem(eventsKey);

        gameState = null;
    }

    // ============================================================
    // INTERNAL VALIDATION
    // ============================================================

    function requireState() {

        if (gameState === null) {
            throw new Error(
                "No game state is loaded. " +
                "Call Manager2.createState() or " +
                "Manager2.initialize() first."
            );
        }
    }

    // ============================================================
    // PUBLIC INTERFACE
    // ============================================================

    return {
        createState,
        initialize,
        hasState,
        resetState,
        storeEvent,

        getState,

        getHuntName,
        getSessionId,
        getStartTime,

        getHunterName,
        setHunterName,

        getStatus,
        setStatus,

        createSilentSlot,
        createSqueakySlot,
        getSlot,
        setSlot,

        slotExists,
        isSqueakySlotName,
        createSqueakyVersion,
        getStorageKey,
        getEventStorageKey,
        generateSessionId,
        generateEventId
    };

})();
