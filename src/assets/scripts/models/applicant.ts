import Utils from '../utils/utils';
import ApplicantInterface from '../interfaces/applicant';
import { GQLNodeInterface, GQLTransactionsResultInterface } from '../interfaces/gqlResult';
import Toast from '../utils/toast';
import Author from './author';
import arweave from '../libs/arweave';
import JobBoard from '../opportunity/jobboard';
import Opportunity from './opportunity';

export default class Applicant implements ApplicantInterface {
  id: string;
  author: Author;
  message: string;
  oppId: string;
  approved: boolean;

  constructor(params: ApplicantInterface) {
    if (Object.keys(params).length) {
      params = Utils.stripTags(params);
      for (let key in params) {
        this[key] = params[key];
      }
    }
  }

  async getMessage(): Promise<string> {
    if (!this.message) {
      const res = await arweave.api.get(`/${this.id}`);
      this.message = Utils.escapeScriptStyles(res.data);
    }

    return this.message;
  }

  async update(params?: { approved: true }, oppOwner?: string, caller?: any) {
    if (params) {
      return this.doUpdate(params, oppOwner, caller);
    }

    const owners = [this.author.address];
    if (oppOwner) {
      owners.push(oppOwner);
    }

    const query = {
      query: `
      query{
        transactions(
          first: 1
          owners: ${JSON.stringify(owners)}
          tags:[
          {
            name: "App-Name",
            values: "CommunityXYZ"
          },
          {
            name: "Action",
            values: "updateApplicant"
          },
          {
            name: "Applicant-ID",
            values: "${this.id}"
          }]
        ){
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
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
      }
      `,
    };

    let txs: GQLTransactionsResultInterface;
    try {
      const res = await arweave.api.request().post('https://arweave.dev/graphql', query);
      txs = res.data.data.transactions;
    } catch (err) {
      console.log(err);
      const toast = new Toast();
      toast.show('Error', 'Error connecting to the network.', 'error', 5000);
      return;
    }

    if (!txs.edges.length) {
      return;
    }

    for (let i = 0; i < txs.edges[0].node.tags.length; i++) {
      if (txs.edges[0].node.tags[i].name === 'approved') {
        // @ts-ignore
        this.approved = txs.edges[0].node.tags[i].value === 'true';
        break;
      }
    }
  }

  private async doUpdate(params: { approved: true }, oppOwner: string, caller: typeof JobBoard) {
    if (!params || !params.approved) {
      return false;
    }

    const wallet = await caller.getAccount().getWallet();
    const toast = new Toast();

    const isOwner = this.author.address !== (await caller.getAccount().getAddress());
    const isOppOwner = oppOwner !== (await caller.getAccount().getAddress());

    if (!isOwner || !isOppOwner) {
      toast.show('Error', 'You cannot update this applicant.', 'error', 3000);
      return false;
    }

    if (!isOppOwner) {
      toast.show('Error', 'You cannot set this applicant as approved.', 'error', 3000);
      return false;
    }

    const fees = await caller.getChargeFee();
    if (!fees) {
      return false;
    }

    let tx = await arweave.createTransaction(
      {
        target: fees.target,
        quantity: fees.winstonQty,
        data: Math.random().toString().substr(-4),
      },
      wallet,
    );
    if (!fees.target || !fees.target.length) {
      await arweave.createTransaction(
        {
          data: Math.random().toString().substr(-4),
        },
        wallet,
      );
    }

    const opp = await Opportunity.getOpportunity(this.oppId);

    tx.addTag('approved', 'true');
    tx.addTag('App-Name', 'CommunityXYZ');
    tx.addTag('Action', 'updateApplicant');
    tx.addTag('Applicant-ID', this.id);
    tx.addTag('Opportunity-ID', this.oppId);
    tx.addTag('Service', 'Community.XYZ');
    tx.addTag('Community-ID', opp.community.id);
    tx.addTag('Message', `Approved applicant ${this.author.address} for the Opportunity ${opp.title} (${this.oppId})`);
    tx.addTag('Type', 'ArweaveActivity');

    await arweave.transactions.sign(tx, wallet);
    const res = await arweave.transactions.post(tx);
    if (res.status !== 200 && res.status !== 202) {
      console.log(res);
      toast.show('Error', 'Error submitting transaction.', 'error', 5000);
      return false;
    }

    caller.getStatusify().add('Approve applicant', tx.id);
    return true;
  }

  static async getAll(oppIds: string[]): Promise<Applicant[]> {
    const query = {
      query: `
      query{
        transactions(tags:[{
          name: "App-Name",
          values: "CommunityXYZ"
        },
        {
          name: "Action",
          values: "Application"
        },
        {
          name: "Opportunity-ID",
          values: ${JSON.stringify(oppIds)}
        }]){
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
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
      }
      `,
    };

    let txs: GQLTransactionsResultInterface;
    try {
      const res = await arweave.api.request().post('https://arweave.dev/graphql', query);
      txs = res.data.data.transactions;
    } catch (err) {
      console.log(err);
      const toast = new Toast();
      toast.show('Error', 'Error connecting to the network.', 'error', 5000);
      return;
    }

    const res: Applicant[] = [];
    for (let i = 0, j = txs.edges.length; i < j; i++) {
      const applicant = await this.nodeToApplicant(txs.edges[i].node);
      res.push(applicant);
    }

    return res;
  }

  static async nodeToApplicant(node: GQLNodeInterface): Promise<Applicant> {
    // Default object
    const objParams: any = {};
    for (let i = 0, j = node.tags.length; i < j; i++) {
      objParams[Utils.stripTags(node.tags[i].name)] = Utils.stripTags(node.tags[i].value);
    }

    const applicant = new Applicant({
      id: node.id,
      author: new Author(node.owner.address, node.owner.address, null),
      message: null,
      oppId: objParams['Opportunity-ID'],
    });
    return applicant;
  }
}
