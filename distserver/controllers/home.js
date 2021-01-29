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
  default: () => HomeController
});
var import_express = __toModule(require("express"));
var import_path = __toModule(require("path"));
var import_mongoose = __toModule(require("mongoose"));
var import_community_js = __toModule(require("community-js"));
var import_pages = __toModule(require("../pages"));
const Account = import_mongoose.default.model("Account", {
  addy: {type: String, unique: true},
  referrer: {type: String, index: true},
  firstTx: Number,
  lastTx: Number,
  date: {type: Date, default: Date.now}
});
const wallet = process.env.WALLET;
console.log(wallet);
class HomeController {
  constructor(arweave) {
    this.path = "/";
    this.router = import_express.default.Router();
    this.isSetTxId = false;
    this.arweave = arweave;
    this.community = new import_community_js.default(arweave, JSON.parse(wallet));
    this.initRoutes();
  }
  initRoutes() {
    this.router.get(this.path, (_, res) => {
      res.sendFile(import_path.default.join(__dirname, "../../dist/index.html"));
    });
    for (const page of import_pages.pages) {
      this.router.get(`${this.path}${page}`, (_, res) => {
        res.sendFile(import_path.default.join(__dirname, `../../dist/${page}.html`));
      });
    }
    this.router.get(`${this.path}chat`, (_, res) => {
      res.redirect("https://discord.gg/5SMgD9t");
    });
    this.router.get(`${this.path}completeclaim`, (_, res) => {
      res.redirect("./claim");
    });
    this.router.post(`${this.path}completeclaim`, this.completeClaim);
  }
  completeClaim(req, res) {
    return __async(this, null, function* () {
      if (!req.body || !req.body.wallet) {
        return res.send("Invalid data.");
      }
      let address = "";
      let referrer = req.body.ref || "";
      try {
        address = yield this.arweave.wallets.jwkToAddress(req.body.wallet);
      } catch (err) {
        return res.send("Invalid params.");
      }
      if (!/[a-z0-9_-]{43}/i.test(address)) {
        return res.send("Invalid address provided.");
      }
      if (referrer.length) {
        referrer = referrer.toString().trim();
      }
      if (!/[a-z0-9_-]{43}/i.test(referrer)) {
        referrer = "";
      }
      let account = null;
      try {
        account = yield Account.findOne({addy: address});
      } catch (err) {
        console.log(err);
        return res.send("Unable to connect, contact the admin.");
      }
      if (!account) {
        const queryFirstTx = `
      query {
        transactions(owners:["${address}"], recipients: [""],
        block: { max: 551000 }, first: 1, sort:HEIGHT_ASC) {
          edges {
            node {
              recipient,
              block {
                height
              }
            }
          }
        }
      }
      `;
        const queryLastTx = `
      query {
        transactions(owners:["${address}"], recipients: [""],
        block: { max: 551000 }, first: 1) {
          edges {
            node {
              recipient,
              block {
                height
              }
            }
          }
        }
      }
      `;
        let firstTx = "";
        let lastTx = "";
        try {
          const r = yield this.arweave.api.post("/graphql", {query: queryFirstTx});
          firstTx = r.data.data.transactions.edges[0].node.block.height;
        } catch (e) {
          return res.send("You don't have any data tx before block 551,000.");
        }
        try {
          const r = yield this.arweave.api.post("/graphql", {query: queryLastTx});
          lastTx = r.data.data.transactions.edges[0].node.block.height;
        } catch (e) {
          return res.send("You don't have any data tx before block 551,000.");
        }
        account = new Account({
          addy: address,
          referrer,
          firstTx,
          lastTx
        });
        try {
          yield account.save();
        } catch (err) {
          console.log(err);
          return res.send("Unable to connect, contact the admin.");
        }
        if (!this.isSetTxId) {
          yield this.community.setCommunityTx("mzvUgNc8YFk0w5K5H7c8pyT-FC5Y_ba0r7_8766Kx74");
          this.isSetTxId = true;
        }
        yield this.community.getState();
        let txid = "";
        try {
          txid = yield this.community.transfer(address, 1e4);
        } catch (e) {
          console.log(e);
          return res.send("Unable to do the transfer, try again later.");
        }
        if (referrer && referrer !== address) {
          this.community.transfer(referrer, 2e3).catch((e) => {
            console.log(e);
          });
        }
        return res.send(`OK-${txid}`);
      }
      return res.send("DONE");
    });
  }
}
//# sourceMappingURL=home.js.map
