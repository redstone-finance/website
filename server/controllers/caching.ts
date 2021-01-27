import GQLResultInterface from 'ar-gql/dist/types';
import Arweave from 'arweave';
import Community from 'community-js';
import { StateInterface } from 'community-js/lib/faces';
import * as express from 'express';
import cors from 'cors';
import Caching from '../models/cache';

const cache = new Caching();
const whitelist = ['https://community.xyz', 'http://community.xyz', 'https://arweave.net', 'http://localhost'];
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

  constructor(arweave: Arweave) {
    this.arweave = arweave;
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
    if(cached) {
      return res.json(JSON.parse(cached));
    }

    return res.json(await this.setCommunities());
  }

  private async setCommunities() {
    const ids = await this.getAllCommunityIds();

    const states: { id: string, state: StateInterface }[] = [];
    let current = -1;
    const go = async (i = 0) => {
      if(i >= ids.length) {
        return true;
      }

      const id = ids[i];
      let state: StateInterface;

      try {
        const community = new Community(this.arweave);
        await community.setCommunityTx(id);
        state = await community.getState(true);

        states.push({id, state});
      } catch(e) {}
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
    let cursor = '';
    let hasNextPage = true;
  
    let ids: string[] = [];
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
        }`,
      };
      const res = await this.arweave.api.post('/graphql', query);
      const data: GQLResultInterface = res.data;
  
      for (let i = 0, j = data.data.transactions.edges.length; i < j; i++) {
        ids.push(data.data.transactions.edges[i].node.id);
      }
      hasNextPage = data.data.transactions.pageInfo.hasNextPage;
  
      if (hasNextPage) {
        cursor = data.data.transactions.edges[data.data.transactions.edges.length - 1].cursor;
      }
    }
  
    return ids;
  }
}
