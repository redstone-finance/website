var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
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
__export(exports, {
  default: () => App
});
var import_express = __toModule(require("express"));
var import_path = __toModule(require("path"));
class App {
  constructor(settings) {
    this.app = import_express.default();
    this.port = settings.port;
    this.middlewares(settings.middleWares);
    this.routes(settings.controllers);
    this.assets();
  }
  listen() {
    this.app.listen(this.port, () => {
      console.log(`App listening on http://localhost:${this.port}`);
    });
  }
  middlewares(mws) {
    mws.forEach((mw) => {
      this.app.use(mw);
    });
  }
  routes(ctrls) {
    ctrls.forEach((ctrl) => {
      this.app.use("/", ctrl.router);
    });
  }
  assets() {
    this.app.use(import_express.default.static(import_path.default.join(__dirname, "../dist")));
  }
  onError() {
    this.app.on("error", () => {
      console.error("app error", this.app.stack);
      console.error("on url", this.app.request.url || "");
      console.error("with headers", this.app.request.header || "");
    });
  }
}
//# sourceMappingURL=app.js.map
