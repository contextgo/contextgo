const hasOwn = Object.prototype.hasOwnProperty;
const toString = Object.prototype.toString;

const isArray = (value) => {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(value);
  }

  return toString.call(value) === '[object Array]';
};

const isPlainObject = (value) => {
  if (!value || toString.call(value) !== '[object Object]') {
    return false;
  }

  const hasOwnConstructor = hasOwn.call(value, 'constructor');
  const hasPrototypeIsPrototypeOf =
    value.constructor && value.constructor.prototype && hasOwn.call(value.constructor.prototype, 'isPrototypeOf');

  if (value.constructor && !hasOwnConstructor && !hasPrototypeIsPrototypeOf) {
    return false;
  }

  let key;

  for (key in value) {
    // Iterate once to match upstream plain-object detection.
  }

  return typeof key === 'undefined' || hasOwn.call(value, key);
};

const assignProperty = (target, name, nextValue) => {
  if (Object.defineProperty && name === '__proto__') {
    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: true,
      value: nextValue,
      writable: true,
    });
    return;
  }

  target[name] = nextValue;
};

const extend = (...args) => {
  let target = args[0];
  let index = 1;
  let deep = false;

  if (typeof target === 'boolean') {
    deep = target;
    target = args[1] || {};
    index = 2;
  }

  if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
    target = {};
  }

  for (; index < args.length; index += 1) {
    const source = args[index];

    if (source == null) {
      continue;
    }

    for (const name in source) {
      const currentValue = target[name];
      const nextValue = source[name];

      if (target === nextValue) {
        continue;
      }

      if (deep && nextValue && (isPlainObject(nextValue) || isArray(nextValue))) {
        const clone = isArray(nextValue)
          ? isArray(currentValue)
            ? currentValue
            : []
          : isPlainObject(currentValue)
            ? currentValue
            : {};

        assignProperty(target, name, extend(true, clone, nextValue));
        continue;
      }

      if (typeof nextValue !== 'undefined') {
        assignProperty(target, name, nextValue);
      }
    }
  }

  return target;
};

export default extend;
