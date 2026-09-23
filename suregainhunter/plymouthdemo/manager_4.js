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
        Event Type (for event use)
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

// This script is included with every clue page

// Load the scipt
// Run a sort of initialization where: check for and load saved state and queue
// And that's all you have to do right off the bat
// Exposed functions:
  // queueEvent()
      //overwrite the Event ID slot with new ID
      //Update Event Timestamp slot
      //Copy the current state and append to queue array
      //Save the queue to localstorage
  // startSession(huntName, huntVersion, hunterName)
    // If all args are passed correctly, and there is no current matching state
    // Then set hunter name from arg
    // create session ID, set start timestamp, set status to active
    // Call queueEvent()
    // Call saveState()
  // resetSession()
    // Clear contents of state and queue from locastorage and from memory
  //slotExists(name)
    // If slot exists, return true. Otherwise return false.
  //createSlot(name, content)
    // Create a slot of the given name with contents "".
    // Call saveState()
  //setSlot(name, content)
    // If slot exists, set slot to new value.
    // If slot name begins with "!" then call queueEvent().
    // Call saveState().
  //readSlot(name, content)
    // If slot exists, return contents
// Internal functions:
  //
//Helper Functions
  // Create session ID
  // Load State
  // Save State
  // Create event ID
  // Load queue
  // Save queue
