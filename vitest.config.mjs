// Mods import Herdr's runtime modules "herdr" and "gpui-kit"; tests swap in stubs.
const stub = (name) => new URL(`./tests/${name}`, import.meta.url).pathname;
export default {
  resolve: { alias: { herdr: stub("herdr-stub.js"), "gpui-kit": stub("gpui-stub.js") } },
};
