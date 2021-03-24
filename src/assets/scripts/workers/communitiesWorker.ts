import { StateInterface } from 'community-js/lib/faces';
import axios from 'axios';
import arweave from '../libs/arweave';
import GQLResultInterface from '../interfaces/gqlResult';
import Community from 'community-js';

export default class CommunitiesWorker {
  static async getAllCommunities(): Promise<{ id: string; state: StateInterface }[]> {
    let result;
    try {
      const res = await axios.get('./caching/communities');
      if (res && res.data) {
        result = res.data;
      } else {
        result = this.loadFromArweave();
      }
    } catch (e) {
      console.log(e);
      result = this.loadFromArweave();
    }

    result = result.filter((r) => !r.state.settings['communityHide'] || r.state.settings['communityHide'] !== 'hide');
    return result;
  }
  static async loadFromArweave() {
    let cursor = '';
    let hasNextPage = true;

    const ids: string[] = [];
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
      const res = await arweave.api.post('/graphql', query);
      const data: GQLResultInterface = res.data;

      for (let i = 0, j = data.data.transactions.edges.length; i < j; i++) {
        ids.push(data.data.transactions.edges[i].node.id);
      }
      hasNextPage = data.data.transactions.pageInfo.hasNextPage;

      if (hasNextPage) {
        cursor = data.data.transactions.edges[data.data.transactions.edges.length - 1].cursor;
      }
    }

    const states: { id: string; state: StateInterface }[] = [];
    let current = -1;
    const go = async (i = 0) => {
      if (i >= ids.length) {
        return true;
      }

      const id = ids[i];
      let state: StateInterface;

      try {
        const community = new Community(arweave);
        await community.setCommunityTx(id);
        state = await community.getState(true);

        // @ts-ignore
        state.settings = Array.from(state.settings).reduce(
          (obj, [key, value]) =>
            Object.assign(obj, { [key]: value }), // Be careful! Maps can have non-String keys; object literals can't.
          {},
        );

        states.push({ id, state });
      } catch (e) {}
      return go(++current);
    };

    const gos = [];
    for (let i = 0, j = 5; i < j; i++) {
      gos.push(go(++current));
    }

    await Promise.all(gos);

    return JSON.parse(JSON.stringify(states));
  }
}
