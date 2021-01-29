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
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (result) => {
      return result.done ? resolve(result.value) : Promise.resolve(result.value).then(fulfilled, rejected);
    };
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
__export(exports, {
  default: () => Caching
});
var memored = __toModule(require("memored"));
var import_cron = __toModule(require("cron"));
class Caching {
  constructor() {
    this._data = new Map();
    new import_cron.CronJob("*/30 * * * *", () => this.clearLocal(), null, true, "America/New_York");
  }
  get(key) {
    return __async(this, null, function* () {
      if (this._data.has(key)) {
        return this._data.get(key);
      }
      return new Promise((resolve, reject) => {
        memored.read(key, (err, val) => {
          if (err)
            return reject(err);
          resolve(val);
        });
      });
    });
  }
  set(key, val) {
    return __async(this, null, function* () {
      return new Promise((resolve, reject) => {
        memored.store(key, val, (err, expTime) => {
          if (err)
            return reject(err);
          resolve(expTime);
          this._data.set(key, val);
        });
      });
    });
  }
  clearLocal() {
    return __async(this, null, function* () {
      const size = +this._data.size.toString();
      this._data.clear();
      console.log(`Map cleared, before: ${size} items, now: ${this._data.size} items.`);
    });
  }
}
//# sourceMappingURL=cache.js.map
