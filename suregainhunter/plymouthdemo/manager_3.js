/*
 * manager_3.js
 *
 * Couple of things to point out:
 * I will just have hunt name and version as a variable in each webpage. Seems best.
 * There is no need to make this file compatible with anyithing else just now
 * There is no need to have separate functions for squeaky and silent slots. I'll just follow the naming convention. "!alpha.1" is squeaky. "alpha.1" is silent.
 *
 */

/*
  State - This is the current state of things locally
    Hard slots - These slots always exist and are filled with specific data:
        Hunt Name
        Hunt Version
        Session ID
        Start Date
        Start Time
        Player Name
        Client Date
        Client Time
        Status
    Soft slots - These slots are created upon request
        
  Queue - This is the buffer of state snapshots
      a function 'triggerEvent' will:
          - Update the current date and time slots
          - Slap a copy of the current state in a slot in the queue
      while there are queued events
          - try to post them to CF worked, using date and time for ID
          
*/

const Manager = (function () {

    // ============================================================
    // SETTINGS
    // ============================================================

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

        const normalized = cleanSlotName(name);

        if (RESERVED_KEYS.has(normalized)) {
            return false;
        }

        return Object.prototype.hasOwnProperty.call(gameState, normalized) ||
            Object.prototype.hasOwnProperty.call(gameState, createSqueakyVersion(normalized));
    }

    function createSlot(kind, name) {

        requireState();

        const slotKind = String(kind).trim().toLowerCase();
        const cleanedName = cleanSlotName(name);

        if (slotKind !== "silent" && slotKind !== "squeaky") {
            throw new Error("The slot kind must be either \"silent\" or \"squeaky\".");
        }

        if (RESERVED_KEYS.has(cleanedName)) {
            throw new Error(
                `The slot name "${cleanedName}" is reserved for game state metadata.`
            );
        }

        const targetName = slotKind === "squeaky"
            ? createSqueakyVersion(cleanedName)
            : cleanedName;

        if (RESERVED_KEYS.has(targetName)) {
            throw new Error(
                `The slot name "${targetName}" is reserved for game state metadata.`
            );
        }

        if (!Object.prototype.hasOwnProperty.call(gameState, targetName)) {
            gameState[targetName] = "";
            saveState();
        }

        return targetName;
    }

    function getSlot(name) {

        requireState();

        const normalized = cleanSlotName(name);
        const resolvedName = resolveSlotReference(normalized);

        if (!Object.prototype.hasOwnProperty.call(gameState, resolvedName)) {
            return null;
        }

        return gameState[resolvedName];
    }

    function setSlot(name, value) {

        requireState();

        const normalized = cleanSlotName(name);

        if (RESERVED_KEYS.has(normalized)) {
            throw new Error(
                `The slot name "${normalized}" is reserved for game state metadata.`
            );
        }

        const targetName = resolveSlotReference(normalized);

        if (!Object.prototype.hasOwnProperty.call(gameState, targetName)) {
            throw new Error(
                `The slot "${normalized}" does not exist.`
            );
        }

        const oldValue = gameState[targetName];

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
        return createSlot("silent", name);
    }

    function createSqueakySlot(name) {
        return createSlot("squeaky", name);
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

        createSlot,
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
