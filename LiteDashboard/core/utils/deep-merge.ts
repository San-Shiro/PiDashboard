/**
 * Deep merge utility for state patches.
 * Supports:
 * - Nested object merging
 * - Dot-notation expansion ("a.b.c": 1 -> {a: {b: {c: 1}}})
 * - Null deletion (setting a key to null removes it)
 * - Array replacement (arrays are not merged, they replace)
 */

export function deepMerge(target: any, patch: any): any {
  if (patch === null || patch === undefined) {
    return patch;
  }
  
  if (typeof patch !== 'object' || Array.isArray(patch)) {
    return patch; // Primitives and arrays replace wholesale
  }

  // Ensure target is an object
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    target = {};
  }

  // Clone target to avoid mutating original directly during intermediate steps
  // (though the caller typically expects mutation, doing it carefully)
  const result = { ...target };

  for (const key of Object.keys(patch)) {
    const value = patch[key];
    
    // Handle dot-notation keys like "settings.fontSize"
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = result;
      
      // Traverse/build the path
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) {
          current[part] = {};
        }
        current = current[part];
      }
      
      // Apply the value to the final leaf
      const lastPart = parts[parts.length - 1];
      if (value === null) {
        delete current[lastPart];
      } else {
        current[lastPart] = deepMerge(current[lastPart], value);
      }
    } else {
      // Normal key
      if (value === null) {
        delete result[key];
      } else {
        result[key] = deepMerge(result[key], value);
      }
    }
  }

  return result;
}
