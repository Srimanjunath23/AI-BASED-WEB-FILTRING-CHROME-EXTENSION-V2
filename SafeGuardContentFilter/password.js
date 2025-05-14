
/**
 * SafeGuard Content Filter - Password Management Utilities
 * Provides functions for password hashing and verification using AES encryption
 */

// Function to hash a password string
async function hashPasswordString(password) {
  try {
    // We'll use SubtleCrypto API for secure hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // First create a SHA-256 hash of the password
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert the hash to a hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
}

// Function to compare a password with a stored hash
async function comparePassword(password, storedHash) {
  try {
    // Hash the provided password
    const hashedPassword = await hashPasswordString(password);
    
    // Compare with stored hash
    return hashedPassword === storedHash;
  } catch (error) {
    console.error('Error comparing password:', error);
    return false;
  }
}

// Function to encrypt data with a password
async function encryptData(data, password) {
  try {
    // Convert password to a key using PBKDF2
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Create an initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encodedData = new TextEncoder().encode(JSON.stringify(data));
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encodedData
    );
    
    // Combine salt, iv, and encrypted data
    const encryptedArray = new Uint8Array(salt.byteLength + iv.byteLength + encryptedData.byteLength);
    encryptedArray.set(salt, 0);
    encryptedArray.set(iv, salt.byteLength);
    encryptedArray.set(new Uint8Array(encryptedData), salt.byteLength + iv.byteLength);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode.apply(null, encryptedArray));
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw error;
  }
}

// Function to decrypt data with a password
async function decryptData(encryptedData, password) {
  try {
    // Convert from base64
    const encryptedArray = new Uint8Array(atob(encryptedData).split('').map(char => char.charCodeAt(0)));
    
    // Extract salt, iv, and encrypted data
    const salt = encryptedArray.slice(0, 16);
    const iv = encryptedArray.slice(16, 28);
    const data = encryptedArray.slice(28);
    
    // Derive the key from the password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );
    
    // Convert the decrypted data to a string and parse as JSON
    return JSON.parse(new TextDecoder().decode(decryptedData));
  } catch (error) {
    console.error('Error decrypting data:', error);
    throw error;
  }
}

// Make functions available globally
window.hashPasswordString = hashPasswordString;
window.comparePassword = comparePassword;
window.encryptData = encryptData;
window.decryptData = decryptData;
