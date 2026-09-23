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
        Start Timestamp
        Player Name
        Event ID (for event use)
        Event Timestamp (for event use)
        Status
    Soft slots - These slots are created upon request
        
  Queue - This is the buffer of state snapshots
      a function 'triggerEvent' will:
          - overwrite the Event ID slot with new ID
          - Update Event Timestamp slot
          - Slap a copy of the current state in a slot in the queue
      while there are queued events
          - try to post them to CF worker
          - [CF worker will try to return success, fail, or duplicate]
          - If success returned, delete event
          - If fail returned, leave in queu
          - if duplicate returned, delete from queu
*/

const Manager = (function () {

    // ============================================================
    // SETTINGS
    // ============================================================

    let gameState = null;

    const RESERVED_KEYS = new Set([
        "huntName,
        "
    ]);

    // ============================================================
    // INTERNAL STORAGE FUNCTIONS
    // ============================================================

    function getCurrentHuntName() {
      // Not needed. Arg will simply be passed every time certain functions are called.
    }

    function getStorageKey(huntName) {
        // Not sure this is needed. key will take the form of "sgh:huntName:huntVersion".
        // either way I suppose I would prefer the function to be called "getStateStorageKey()."
        return `hunt:${huntName}:state`;
    }

    function getEventStorageKey(huntName) {
        // Same as above. Call it "getQueueStorageKey()"
        // But it's not 'getting' the key, exactly... it's more like building the key from know information.
        return `hunt:${huntName}:events`;
    }

    function saveState() {
        // This makes sense to be. "Given an active gamestate, save it to the associated key in localstorage."
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
        // this make sense... This function returns the gamestate, which means it will be used to fill the gamestate object provided one is stored.
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
        // I want this to be named loadQueue().
        //I don't understand everything in this. I suppose you have to load the queue because you can't actively read something sitting in storage.
        //It's storage... not an active variable. Hence you have to open the box and make a copy of it before you can edit it all all... or even read. i guess.
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
        // I would prefer that this be called 'saveQueue()'
        // Naturally...
        localStorage.setItem(
            getEventStorageKey(huntName),
            JSON.stringify(events)
        );
    }

    function generateEventId() {
    //Helper function
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
      //Helper function
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
        This will need to be reworked according to the new structure.
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
        // Truth be told... I'm not sure I understand when this is getting called. Probably for any occasion where a slot is being set.
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
        // This function will need some reworking. It should take huntName, HuntVersion, and hunterName for arguments, and fill the rest automatically.
        // It should not return succesfully unless all three fields are provided validly and there is no active session.
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
        // Helper function.
        return loadState(huntName) !== null;
    }

    function initialize(huntName = getCurrentHuntName()) {
        // This will need some reworking. I'm actually not sure how it differs from createState().
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
        // Not sure about this one.
        return queueEvent(eventType, details);
    }

    // ============================================================
    // WHOLE STATE
    // ============================================================

    function getState() {

        if (gameState === null) {
          // Also not very sure about this one.
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

    // I want all slots - both hard and soft - to be accessible by these functions. If a page wants to reset the start time, fine. I'm the one writing the pages, anyway.
    // Also, as we discussed, there won't be an name normalization or anything. I'll just try to follow my own naming conventions.
  
    function slotExists(name) {
        // This makes sense. Just tells you whether a slot exists.
        requireState();

        const normalized = cleanSlotName(name);

        if (RESERVED_KEYS.has(normalized)) {
            return false;
        }

        return Object.prototype.hasOwnProperty.call(gameState, normalized) ||
            Object.prototype.hasOwnProperty.call(gameState, createSqueakyVersion(normalized));
    }

    function createSlot(kind, name) {
        // Understood. But will not need to know whether is silent or squeaky for this step.
        // Also, is this step strictly necessary? I suppose setSlot could be used directly... though I like the idea of creating a slot and then filling it.
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
        // Again. No need to clean names, but we will have to cheeck whether the name has an exclamation point in front.
        // If so, then it's squeaky. So set the new info into the slot, and then call queueEvent().
        // I'm not sure if it matters whether the contents of the squeaky slot have actually changed.
        // If player alice tries the same answer in squeaky slot three times in a row, I think I want to know that.
        // I think it only matter that a clue page is calling setSlot() on a squeaky slot.
        // Also, all structural data should be treated as squeaky, so we'll have to check for those slots being set by name.
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

    // These look unnecessary to me.
    function createSilentSlot(name) {
        return createSlot("silent", name);
    }

    function createSqueakySlot(name) {
        return createSlot("squeaky", name);
    }

    // ============================================================
    // RESET
    // ============================================================
    // Here's a puzzler. I want the user to be able to blank out their session.
    // I also want to know when theat happens... So perhaps the right way to handle that is to have resetState() set status to 'reset.'
    // and setting that slot will call queueEvent(). Then start a timer that waits long enough to probably post the event,
    // and then wipe everything regardless when the short timer ends.
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
