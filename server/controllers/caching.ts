import Arweave from 'arweave';
import Community from 'community-js';
import { StateInterface } from 'community-js/lib/faces';
import * as express from 'express';
import cors from 'cors';
import Caching from '../models/cache';
import GQLResultInterface from 'ar-gql/dist/faces';
import ArDB from 'ardb';
import { GQLEdgeTransactionInterface, GQLTransactionInterface } from 'ardb/lib/faces/gql';

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

  private arweave: Arweave;
  private ardb: ArDB;

  constructor(arweave: Arweave) {
    this.arweave = arweave;
    this.ardb = new ArDB(arweave);
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
        return res.json(await this.setCommunities());
      }
      const toSend: any[] = [];
      console.log('cached');
      for (const obj of cache) {
        console.log(obj);
        if (!obj.state.error) {
          toSend.push(obj);
        }
      }

      return res.json(toSend);
    }

    console.log('not from cache');
    return res.json(await this.setCommunities());
  }

  private async setCommunities(): Promise<{
    id: string;
    state: StateInterface;
  }[]> {
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
        const community = new Community(this.arweave);
        await community.setCommunityTx(id);
        state = await community.getState(true);

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
    cache.set('getcommunities', JSON.stringify(states)).catch(console.log);

    setTimeout(() => this.setCommunities(), 1000 * 60 * 30);

    return states;
  }

  private async getAllCommunityIds(): Promise<string[]> {
    let res;

    try {
      res = await this.ardb.appName('SmartWeaveContract')
        .tag('Contract-Src', ['ngMml4jmlxu0umpiQCsHgPX2pb_Yz6YDB8f7G6j-tpI'])
        .only([
          'id',
          'tags'
        ]).findAll() as GQLEdgeTransactionInterface[];
    } catch (e) {
      console.log(e);
      return [];
    }

    let ids: string[] = [];

    for (const tx of res) {
      if (!tx.node.tags) {
        console.log(tx);
        continue;
      }

      let isAtomic = false;
      for (const tag of tx.node.tags) {
        if (tag.name === 'Init-State') {
          isAtomic = true;
          break;
        }
      }
      if (!isAtomic) ids.push(tx.node.id);
    }

    console.log('load completed!');

    return ids;
  }
}
