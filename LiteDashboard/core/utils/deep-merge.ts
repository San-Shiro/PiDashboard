/**
 * Deep merge utility for state patches.
 * Supports:
 * - Nested object merging
 * - Dot-notation expansion ("a.b.c": 1 -> {a: {b: {c: 1}}})
 * - Null deletion (setting a key to null removes it)
 * - Array replacement (arrays are not merged, they replace)
 */

export function deepMerge(target: any, patch: any, depth: number = 0): any {
  if (depth > 50) return target; // Prevent circular reference stack overflows

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
    // Block prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const value = patch[key];
    
    // Handle dot-notation keys like "settings.fontSize"
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = result;
      let safePath = true;
      
      // Traverse/build the path
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
          safePath = false;
          break;
        }
        if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) {
          current[part] = {};
        }
        current = current[part];
      }
      
      if (!safePath) continue;

      // Apply the value to the final leaf
      const lastPart = parts[parts.length - 1];
      if (lastPart === '__proto__' || lastPart === 'constructor' || lastPart === 'prototype') {
        continue;
      }

      if (value === null) {
        delete current[lastPart];
      } else {
        current[lastPart] = deepMerge(current[lastPart], value, depth + 1);
      }
    } else {
      // Normal key
      if (value === null) {
        delete result[key];
      } else {
        result[key] = deepMerge(result[key], value, depth + 1);
      }
    }
  }

  return result;
}
