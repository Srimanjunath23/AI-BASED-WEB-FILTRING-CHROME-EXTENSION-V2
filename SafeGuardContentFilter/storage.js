/**
 * SafeGuard Content Filter - Storage Utilities
 * Provides functions for managing extension settings and statistics
 */

// Default settings
const DEFAULT_SETTINGS = {
  filterNSFW: true,
  filterViolence: true,
  filterSuicide: true,
  educationalMode: true,
  sensitivityLevel: 'medium', // low, medium, high
  password: '',
  isSetup: false,
  stats: {
    sitesBlocked: 0,
    imagesFiltered: 0,
    searchesBlocked: 0
  }
};

// Get all settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (items) => {
      // If no settings found, use defaults
      if (Object.keys(items).length === 0) {
        resolve(DEFAULT_SETTINGS);
      } else {
        // Merge with defaults to ensure all properties exist
        resolve({...DEFAULT_SETTINGS, ...items});
      }
    });
  });
}

// Save settings to storage
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      resolve();
    });
  });
}

// Reset settings to defaults
async function resetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.clear(() => {
      chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
        resolve();
      });
    });
  });
}

// Increment statistics counter
async function incrementStat(statName) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (items) => {
      const stats = items.stats || DEFAULT_SETTINGS.stats;
      
      // Increment the specified stat
      if (statName in stats) {
        stats[statName]++;
      }
      
      // Save updated stats
      chrome.storage.sync.set({ stats }, () => {
        resolve(stats);
      });
    });
  });
}

// Record a blocked site
async function recordBlockedSite(url, reason, keywords) {
  try {
    // Increment sites blocked counter
    await incrementStat('sitesBlocked');
    
    // Record detailed log in local storage (not synced)
    // We'll limit to last 100 entries to avoid using too much storage
    chrome.storage.local.get(['blockLog'], (items) => {
      const blockLog = items.blockLog || [];
      
      // Add new entry
      blockLog.unshift({
        timestamp: Date.now(),
        url,
        reason,
        keywords
      });
      
      // Limit to 100 entries
      if (blockLog.length > 100) {
        blockLog.length = 100;
      }
      
      // Save updated log
      chrome.storage.local.set({ blockLog });
    });
  } catch (error) {
    console.error('Error recording blocked site:', error);
  }
}

// Record a filtered image
async function recordFilteredImage(url, keywords) {
  try {
    // Increment images filtered counter
    await incrementStat('imagesFiltered');
    
    // We can add more detailed logging if needed in the future
  } catch (error) {
    console.error('Error recording filtered image:', error);
  }
}

// Record a blocked search
async function recordBlockedSearch(query, keywords) {
  try {
    // Increment searches blocked counter
    await incrementStat('searchesBlocked');
    
    // Record in local storage
    chrome.storage.local.get(['searchLog'], (items) => {
      const searchLog = items.searchLog || [];
      
      // Add new entry
      searchLog.unshift({
        timestamp: Date.now(),
        query,
        keywords
      });
      
      // Limit to 100 entries
      if (searchLog.length > 100) {
        searchLog.length = 100;
      }
      
      // Save updated log
      chrome.storage.local.set({ searchLog });
    });
  } catch (error) {
    console.error('Error recording blocked search:', error);
  }
}

// Get activity logs
async function getActivityLogs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['blockLog', 'searchLog'], (items) => {
      resolve({
        blockLog: items.blockLog || [],
        searchLog: items.searchLog || []
      });
    });
  });
}

// Clear activity logs
async function clearActivityLogs() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['blockLog', 'searchLog'], () => {
      resolve();
    });
  });
}

// Export functions for both CommonJS and ESM
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSettings,
    saveSettings,
    resetSettings,
    incrementStat,
    recordBlockedSite,
    recordFilteredImage,
    recordBlockedSearch,
    getActivityLogs,
    clearActivityLogs
  };
}

// Export for ESM
export {
  getSettings,
  saveSettings,
  resetSettings,
  incrementStat,
  recordBlockedSite,
  recordFilteredImage,
  recordBlockedSearch,
  getActivityLogs,
  clearActivityLogs
};
