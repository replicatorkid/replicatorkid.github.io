/*
 * manager.js
 *
 * Game-state manager for browser-based treasure hunts.
 *
 * Pages using this file should interact with game state through Manager.
 * They should NOT directly use localStorage.
 *
 * Current responsibilities:
 *   - Create and load game state
 *   - Save game state to localStorage
 *   - Manage hunter information and hunt status
 *   - Create, read, and modify silent/squeaky slots
 *   - Prepare the groundwork for automatic analytics events
 *
 * Future responsibilities:
 *   - Queue outgoing analytics events
 *   - Send queued events to the Cloudflare Worker
 *   - Retry failed transmissions
 */


const Manager = (function () {

    // ============================================================
    // SETTINGS
    // ============================================================

    // Current version of the game-state format.
    // Increase this if the structure of the saved state changes.
    const SCHEMA_VERSION = 1;

    // The current game state.
    // This is loaded when Manager.initialize() is called.
    let gameState = null;

    // ============================================================
    // INTERNAL STORAGE FUNCTIONS
    // ============================================================

    /*
     * Construct the localStorage key for a hunt.
     *
     * Example:
     *     hunt:plymouthdemo:state
     */
    function getStorageKey(huntName) {
        return `hunt:${huntName}:state`;
    }


    /*
     * Save the current game state to localStorage.
     */
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


    /*
     * Load a game state from localStorage.
     *
     * Returns the state if one exists.
     * Returns null if none exists.
     */
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
            throw new Error(
                "The saved game state could not be read."
            );
        }
    }


    // ============================================================
    // ANALYTICS FOUNDATION
    // ============================================================

    /*
     * Called whenever a state change occurs.
     *
     * This is intentionally internal.
     *
     * For now, this function does not actually send anything.
     * Later it will determine whether the change deserves an
     * analytics event, create the event, put it into an outgoing
     * queue, and eventually send that queue to the Worker.
     */
    function stateChanged(slotName, oldValue, newValue) {

        /*
         * FUTURE:
         *
         * If the slot is squeaky:
         *
         *     create an event containing things such as:
         *         session ID
         *         hunt name
         *         timestamp
         *         slot name
         *         old value
         *         new value
         *
         *     put event into outgoing event queue
         *
         * The queue will eventually survive loss of internet
         * connectivity and retry until the Worker accepts the event.
         */
    }


    // ============================================================
    // STATE CREATION
    // ============================================================

    /*
     * Create a new game state.
     *
     * hunterName is optional.
     *
     * Example:
     *
     *     Manager.createState("plymouthdemo", 1, "Nick");
     *
     * or:
     *
     *     Manager.createState("plymouthdemo", 1);
     */
    function createState(huntName, schemaVersion, hunterName = "") {

        // Hunt name is required.
        if (!huntName) {
            throw new Error(
                "Cannot create game state: hunt name is required."
            );
        }

        // Schema version is required.
        if (schemaVersion === undefined || schemaVersion === null) {
            throw new Error(
                "Cannot create game state: schema version is required."
            );
        }

        // Do not overwrite an existing game.
        const existingState = loadState(huntName);

        if (existingState !== null) {
            throw new Error(
                `A game state already exists for "${huntName}". ` +
                `Use Manager.resetState() if you intentionally want ` +
                `to start over.`
            );
        }

        // Generate a session ID.
        //
        // This is deliberately separate from the start timestamp.
        // The Worker/D1 system may find this useful later.
        const sessionId = generateSessionId();

        // Create the initial state.
        gameState = {

            version: schemaVersion,

            huntName: huntName,

            sessionId: sessionId,

            startedAt: new Date().toISOString(),

            hunterName: hunterName,

            status: "incomplete",

            slots: {}

        };

        saveState();

        return getState();
    }


    /*
     * Generate a reasonably unique session ID.
     *
     * This does not need to contain meaningful information.
     * Its job is simply to give this particular playthrough a
     * convenient identifier for future analytics/database use.
     */
    function generateSessionId() {

        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }

        // Fallback for browsers without crypto.randomUUID().
        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).substring(2, 10)
        );
    }


    // ============================================================
    // STATE EXISTENCE / INITIALIZATION
    // ============================================================

    /*
     * Check whether a game state exists for a hunt.
     */
    function hasState(huntName) {

        return loadState(huntName) !== null;
    }


    /*
     * Load an existing state into Manager.
     *
     * This is useful when a page loads after another page has
     * already created the game.
     *
     * Example:
     *
     *     Manager.initialize("plymouthdemo");
     */
    function initialize(huntName) {

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
    // WHOLE STATE
    // ============================================================

    /*
     * Return the complete current game state.
     *
     * A copy is returned so that pages cannot accidentally modify
     * Manager's internal state without going through Manager.
     */
    function getState() {

        if (gameState === null) {
            throw new Error(
                "No game state is currently loaded."
            );
        }

        return JSON.parse(JSON.stringify(gameState));
    }


    // ============================================================
    // STRUCTURAL DATA
    // ============================================================

    /*
     * Get hunter name.
     */
    function getHunterName() {

        requireState();

        return gameState.hunterName;
    }


    /*
     * Set hunter name.
     *
     * Hunter name is structural data, not a slot.
     */
    function setHunterName(name) {

        requireState();

        gameState.hunterName = name;

        saveState();
    }


    /*
     * Get hunt name.
     */
    function getHuntName() {

        requireState();

        return gameState.huntName;
    }


    /*
     * Get session ID.
     */
    function getSessionId() {

        requireState();

        return gameState.sessionId;
    }


    /*
     * Get start date/time.
     */
    function getStartTime() {

        requireState();

        return gameState.startedAt;
    }


    /*
     * Get hunt status.
     */
    function getStatus() {

        requireState();

        return gameState.status;
    }


    /*
     * Set hunt status.
     *
     * Status is structural data, not a slot.
     */
    function setStatus(status) {

        requireState();

        gameState.status = status;

        saveState();
    }


    // ============================================================
    // SLOTS
    // ============================================================

    /*
     * Create a SILENT slot.
     *
     * If the slot already exists, do nothing.
     *
     * Example:
     *
     *     Manager.createSilentSlot("notes.alpha");
     */
    function createSilentSlot(name) {

        requireState();

        if (slotExists(name)) {
            return;
        }

        gameState.slots[name] = {
            report: false,
            value: ""
        };

        saveState();
    }


    /*
     * Create a SQUEAKY slot.
     *
     * If the slot already exists, do nothing.
     *
     * Example:
     *
     *     Manager.createSqueakySlot("alpha.finalAnswer");
     */
    function createSqueakySlot(name) {

        requireState();

        if (slotExists(name)) {
            return;
        }

        gameState.slots[name] = {
            report: true,
            value: ""
        };

        saveState();
    }


    /*
     * Determine whether a slot exists.
     */
    function slotExists(name) {

        return Object.prototype.hasOwnProperty.call(
            gameState.slots,
            name
        );
    }


    /*
     * Get the value of a slot.
     *
     * Returns null if the slot does not exist.
     *
     * Example:
     *
     *     const answer = Manager.getSlot("alpha.2");
     */
    function getSlot(name) {

        requireState();

        if (!slotExists(name)) {
            return null;
        }

        return gameState.slots[name].value;
    }


    /*
     * Set the value of a slot.
     *
     * If the slot does not already exist, automatically create it
     * as a SILENT slot.
     *
     * This makes simple text-input use very convenient.
     *
     * Example:
     *
     *     Manager.setSlot("alpha.2", input.value);
     */
    function setSlot(name, value) {

        requireState();

        // Automatically create nonexistent slots as silent.
        if (!slotExists(name)) {

            gameState.slots[name] = {
                report: false,
                value: ""
            };
        }

        const slot = gameState.slots[name];

        const oldValue = slot.value;

        // Don't do anything if the value actually hasn't changed.
        if (oldValue === value) {
            return;
        }

        // Change the value.
        slot.value = value;

        // Save immediately.
        saveState();

        // If this is a squeaky slot, notify the internal
        // analytics machinery.
        if (slot.report === true) {
            stateChanged(
                name,
                oldValue,
                value
            );
        }
    }


    // ============================================================
    // RESET
    // ============================================================

    /*
     * Deliberately erase the current game state.
     *
     * Example:
     *
     *     Manager.resetState();
     *
     * This should be connected to a deliberate "Reset Hunt"
     * action rather than something the player can trigger
     * accidentally.
     */
    function resetState() {

        requireState();

        const key = getStorageKey(gameState.huntName);

        localStorage.removeItem(key);

        gameState = null;
    }


    // ============================================================
    // INTERNAL VALIDATION
    // ============================================================

    /*
     * Make sure Manager currently has a game state loaded.
     */
    function requireState() {

        if (gameState === null) {
            throw new Error(
                "No game state is loaded. " +
                "Call Manager.createState() or " +
                "Manager.initialize() first."
            );
        }
    }


    // ============================================================
    // PUBLIC INTERFACE
    // ============================================================

    /*
     * Everything returned here becomes available as:
     *
     *     Manager.someFunction()
     *
     * Nothing else inside this function is directly exposed.
     */
    return {

        // State creation / loading
        createState,
        initialize,
        hasState,
        resetState,

        // Whole state
        getState,

        // Structural information
        getHuntName,
        getSessionId,
        getStartTime,

        getHunterName,
        setHunterName,

        getStatus,
        setStatus,

        // Slots
        createSilentSlot,
        createSqueakySlot,
        getSlot,
        setSlot

    };

})();
