// Mods import Herdr's runtime module "herdr"; tests swap in a stub.
export default {
  resolve: { alias: { herdr: new URL("./tests/herdr-stub.js", import.meta.url).pathname } },
};
