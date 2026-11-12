/**
 * Babylon.js under Jest: jsdom has no WebGL, and the engine ships ES modules
 * Jest does not transform. Every export is a stand-in that accepts any
 * construction, call or property access, so the capability's React shell
 * renders and can be tested; the 3D scene itself is the journey spec's, in a
 * real browser (ADR-129).
 */
function stand() {
  const fn = function () {
    return stand();
  };
  return new Proxy(fn, {
    get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'then' ? undefined : stand()),
    construct: () => stand(),
    apply: () => stand(),
    set: () => true,
  });
}
module.exports = new Proxy({ __esModule: true }, { get: (t, key) => (key in t ? t[key] : stand()) });
