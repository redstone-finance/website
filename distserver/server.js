var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __exportStar = (target, module2, desc) => {
  __markAsModule(target);
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  if (module2 && module2.__esModule)
    return module2;
  return __exportStar(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", {value: module2, enumerable: true}), module2);
};
var import_morgan = __toModule(require("morgan"));
var import_compression = __toModule(require("compression"));
var import_body_parser = __toModule(require("body-parser"));
var import_helmet = __toModule(require("helmet"));
var import_throng = __toModule(require("throng"));
var import_memored = __toModule(require("memored"));
var import_arweave = __toModule(require("arweave"));
var import_app = __toModule(require("./app"));
var import_home = __toModule(require("./controllers/home"));
var import_caching = __toModule(require("./controllers/caching"));
var import_redirection = __toModule(require("./controllers/redirection"));
const arweave = import_arweave.default.init({
  host: "arweave.net",
  protocol: "https",
  port: 443
});
const worker = (id, disconnect) => {
  console.log(`Started worker ${id}`);
  const app = new import_app.default({
    port: 5e3,
    controllers: [new import_home.default(arweave), new import_caching.default(arweave), new import_redirection.default()],
    middleWares: [
      import_morgan.default("tiny"),
      import_body_parser.default.json(),
      import_body_parser.default.urlencoded({extended: true}),
      import_compression.default(),
      import_helmet.default({
        contentSecurityPolicy: false
      })
    ]
  });
  app.listen();
  process.on("SIGTERM", () => {
    console.log(`Worker ${id} exiting (cleanup here)`);
    disconnect();
  });
};
import_memored.default.setup({
  purgeInterval: 1e3 * 60 * 60 * 0.5
});
const WORKERS = +(process.env.WEB_CONCURRENCY || 1);
import_throng.default({
  count: WORKERS,
  lifetime: Infinity,
  worker
});
//# sourceMappingURL=server.js.map
