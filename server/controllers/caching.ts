import Ardk from 'ardk';
import { SmartWeaveNodeFactory, LoggerFactory, SmartWeave } from "redstone-smartweave";
import { StateInterface } from 'community-js/lib/faces';
import * as express from 'express';
import cors from 'cors';
import Caching from '../models/cache';
import ArDB from 'ardb';
import ArdbTransaction from 'ardb/lib/models/transaction';

LoggerFactory.INST.logLevel('fatal');

const cache = new Caching();
const whitelist = ['https://community.xyz', 'http://community.xyz', 'https://arweave.live', 'https://arweave.net', 'http://localhost:5000'];

const corsOptionsDelegate = function (req, callback) {
  let corsOptions = { origin: false };
  if (whitelist.indexOf(req.header('Origin')) !== -1) {
    corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
  }
  callback(null, corsOptions) // callback expects two parameters: error and options
}

export default class CacheController {
  path = '/caching/';
  router = express.Router();

  private ardk: Ardk;
  private ardb: ArDB;
  private smartweave: SmartWeave;

  private isUpdating: boolean = false;

  constructor(ardk: Ardk) {
    this.ardk = ardk;

    // @ts-ignore
    this.ardb = new ArDB(ardk);
    // @ts-ignore
    this.smartweave = SmartWeaveNodeFactory.memCached(ardk);
    this.setCommunities();

    this.initRoutes();
  }

  private initRoutes() {
    // @ts-ignore
    this.router.get(`${this.path}communities`, cors(corsOptionsDelegate), async (req, res) => {
      await this.getCommunities(req, res);
    });
  }

  private async getCommunities(req: express.Request, res: express.Response) {
    const cached = await cache.get('getcommunities');

    if (cached) {
      const cache: any[] = JSON.parse(cached);
      if (!cache.length) {
        await this.setCommunities();
        return res.status(404).send();
      }

      return res.json(cache);
    }

    const state = await this.setCommunities();
    return res.json(state);
  }

  private async setCommunities(): Promise<{
    id: string;
    state: StateInterface;
  }[]> {
    if (this.isUpdating) return [];
    this.isUpdating = true;

    console.log('Updating all the communities...');
    const ids = await this.getAllCommunityIds();
    if (!ids || !ids.length) {
      return [];
    }

    const states: { id: string, state: StateInterface }[] = [];
    let current = -1;
    const go = async (i = 0) => {
      if (i >= ids.length) {
        return true;
      }

      const id = ids[i];
      let state: StateInterface;

      try {

        const psc = this.smartweave.contract(id);
        const res = await psc.readState();
        state = res.state as StateInterface;

        // @ts-ignore
        state.settings = Array.from(state.settings).reduce((obj, [key, value]) => (
          Object.assign(obj, { [key]: value }) // Be careful! Maps can have non-String keys; object literals can't.
        ), {});

        states.push({ id, state });
      } catch (e) { }
      return go(++current);
    };

    const gos = [];
    for (let i = 0, j = 5; i < j; i++) {
      gos.push(go(++current));
    }

    await Promise.all(gos);
    if (states.length) {
      cache.set('getcommunities', JSON.stringify(states)).catch(console.log);
    }

    setTimeout(() => this.setCommunities(), 1000 * 60 * 30);

    this.isUpdating = false;
    console.log('Done!');
    // @ts-ignore
    return states.filter(obj => !obj.state.error);
  }

  private async getAllCommunityIds(): Promise<string[]> {
    let res;

    try {
      res = (await this.ardb
        .search('transactions')
        .appName('SmartWeaveContract')
        .tags([
          {
            name: 'Contract-Src',
            values: ['ngMml4jmlxu0umpiQCsHgPX2pb_Yz6YDB8f7G6j-tpI', '40tPvYdnGiSpwgnqrS2xJ2dqSvA6h8K11HjJxMs1cbI'],
          },
          { name: 'Content-Type', values: 'application/json' },
        ])
        .findAll()) as ArdbTransaction[];
    } catch (e) {
      console.log(e);
      return [];
    }

    let ids: string[] = [];

    for (const tx of res) {
      if (!tx.tags) {
        console.log(tx);
        continue;
      }

      let isAtomic = false;
      for (const tag of tx.tags) {
        if (tag.name === 'Init-State') {
          isAtomic = true;
          break;
        }
      }
      if (!isAtomic) ids.push(tx.id);
    }

    console.log('load completed!');

    return ids;
  }
}
