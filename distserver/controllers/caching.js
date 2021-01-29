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
  default: () => CacheController
});
var import_community_js = __toModule(require("community-js"));
var express = __toModule(require("express"));
var import_cors = __toModule(require("cors"));
var import_cache = __toModule(require("../models/cache"));
const cache = new import_cache.default();
const whitelist = ["https://community.xyz", "http://community.xyz", "https://arweave.net", "http://localhost"];
const corsOptionsDelegate = function(req, callback) {
  let corsOptions = {origin: false};
  if (whitelist.indexOf(req.header("Origin")) !== -1) {
    corsOptions = {origin: true};
  }
  callback(null, corsOptions);
};
class CacheController {
  constructor(arweave) {
    this.path = "/caching/";
    this.router = express.Router();
    this.arweave = arweave;
    this.setCommunities();
    this.initRoutes();
  }
  initRoutes() {
    this.router.get(`${this.path}communities`, import_cors.default(corsOptionsDelegate), (req, res) => __async(this, null, function* () {
      yield this.getCommunities(req, res);
    }));
  }
  getCommunities(req, res) {
    return __async(this, null, function* () {
      const cached = yield cache.get("getcommunities");
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      return res.json(yield this.setCommunities());
    });
  }
  setCommunities() {
    return __async(this, null, function* () {
      const ids = yield this.getAllCommunityIds();
      const states = [];
      let current = -1;
      const go = (i = 0) => __async(this, null, function* () {
        if (i >= ids.length) {
          return true;
        }
        const id = ids[i];
        let state;
        try {
          const community = new import_community_js.default(this.arweave);
          yield community.setCommunityTx(id);
          state = yield community.getState(true);
          state.settings = Array.from(state.settings).reduce((obj, [key, value]) => Object.assign(obj, {[key]: value}), {});
          states.push({id, state});
        } catch (e) {
        }
        return go(++current);
      });
      const gos = [];
      for (let i = 0, j = 5; i < j; i++) {
        gos.push(go(++current));
      }
      yield Promise.all(gos);
      cache.set("getcommunities", JSON.stringify(states)).catch(console.log);
      setTimeout(() => this.setCommunities(), 1e3 * 60 * 30);
      return states;
    });
  }
  getAllCommunityIds() {
    return __async(this, null, function* () {
      let cursor = "";
      let hasNextPage = true;
      let ids = [];
      while (hasNextPage) {
        const query = {
          query: `query {
          transactions(
            tags: [
              {name: "App-Name", values: ["SmartWeaveContract"]},
              {name: "Contract-Src", values: ["ngMml4jmlxu0umpiQCsHgPX2pb_Yz6YDB8f7G6j-tpI"]}
            ]
            after: "${cursor}"
            first: 100
          ) {
            pageInfo {
              hasNextPage
            }
            edges {
              cursor
              node {
                id
                recipient
                quantity {
                  ar
                }
                owner {
                  address
                },
                tags {
                  name,
                  value
                }
                block {
                  timestamp
                  height
                }
              }
            }
          }
        }`
        };
        const res = yield this.arweave.api.post("/graphql", query);
        const data = res.data;
        for (let i = 0, j = data.data.transactions.edges.length; i < j; i++) {
          ids.push(data.data.transactions.edges[i].node.id);
        }
        hasNextPage = data.data.transactions.pageInfo.hasNextPage;
        if (hasNextPage) {
          cursor = data.data.transactions.edges[data.data.transactions.edges.length - 1].cursor;
        }
      }
      return ids;
    });
  }
}
//# sourceMappingURL=caching.js.map
