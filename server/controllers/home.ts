import express from 'express';
import path from 'path';
import Ardk from 'ardk';
//import Community from 'community-js';
import { pages } from '../pages';

export default class HomeController {
  path = '/';
  router = express.Router();

  private isSetTxId = false;
  private ardk: Ardk;
  //private community: Community;

  constructor(ardk: Ardk) {
    this.ardk = ardk;
    this.initRoutes();
  }

  private async initRoutes() {
    // @ts-ignore
    //this.community = new Community(this.ardk, await this.ardk.wallets.generate());

    this.router.get(this.path, (_, res) => {
      res.sendFile(path.join(__dirname, '../../dist/index.html'));
    });

    for (const page of pages) {
      this.router.get(`${this.path}${page}`, (_, res) => {
        res.sendFile(path.join(__dirname, `../../dist/${page}.html`));
      });
    }

    this.router.get(`${this.path}chat`, (_, res) => {
      res.redirect('https://discord.gg/GtS2NzVAJG');
    });

    this.router.get(`${this.path}completeclaim`, (_, res) => {
      res.redirect('./home');
    });

    this.router.post(`${this.path}completeclaim`, (req, res) => {
      res.redirect('./home')
      // return this.completeClaim(req, res);
    });

    this.router.get(`${this.path}claim`, (req, res) => {
      res.redirect('./home');
    })
  }

  // private async completeClaim(req: express.Request, res: express.Response) {
  //   if (!req.body || !req.body.tx) {
  //     return res.send('Invalid data.');
  //   }
  //   let referrer = req.body.ref || '';

  //   const tx = this.arweave.transactions.fromRaw(JSON.parse(req.body.tx));
  //   const address = await this.arweave.wallets.ownerToAddress(tx.owner);

  //   if (address !== tx.get('data', { decode: true, string: true })) {
  //     return res.send('Invalid owner!');
  //   }

  //   if (!(await this.arweave.transactions.verify(tx))) {
  //     return res.send('You do not own this wallet address.');
  //   }

  //   if (!/[a-z0-9_-]{43}/i.test(address)) {
  //     return res.send('Invalid address provided.');
  //   }

  //   if (referrer.length) {
  //     referrer = referrer.toString().trim();
  //   }
  //   if (!/[a-z0-9_-]{43}/i.test(referrer)) {
  //     referrer = '';
  //   }

  //   let account = null;
  //   try {
  //     account = await Account.findOne({ addy: address });
  //   } catch (err) {
  //     console.log(err);
  //     return res.send('Unable to connect, contact the admin.');
  //   }

  //   if (!account) {
  //     const queryFirstTx = `
  //     query {
  //       transactions(owners:["${address}"], recipients: [""],
  //       block: { max: 551000 }, first: 1, sort:HEIGHT_ASC) {
  //         edges {
  //           node {
  //             recipient,
  //             block {
  //               height
  //             }
  //           }
  //         }
  //       }
  //     }
  //     `;
  //     const queryLastTx = `
  //     query {
  //       transactions(owners:["${address}"], recipients: [""],
  //       block: { max: 551000 }, first: 1) {
  //         edges {
  //           node {
  //             recipient,
  //             block {
  //               height
  //             }
  //           }
  //         }
  //       }
  //     }
  //     `;

  //     let firstTx = '';
  //     let lastTx = '';
  //     try {
  //       const r = await this.arweave.api.post('/graphql', { query: queryFirstTx });
  //       firstTx = r.data.data.transactions.edges[0].node.block.height;
  //     } catch (e) {
  //       return res.send('You don\'t have any data tx before block 551,000.');
  //     }

  //     try {
  //       const r = await this.arweave.api.post('/graphql', { query: queryLastTx });
  //       lastTx = r.data.data.transactions.edges[0].node.block.height;
  //     } catch (e) {
  //       return res.send('You don\'t have any data tx before block 551,000.');
  //     }

  //     // Save the account
  //     account = new Account({
  //       addy: address,
  //       referrer: referrer,
  //       firstTx,
  //       lastTx
  //     });
  //     try {
  //       await account.save();
  //     } catch (err) {
  //       console.log(err);
  //       return res.send('Unable to connect, contact the admin.');
  //     }

  //     // Send the tokens
  //     if (!this.isSetTxId) {
  //       await this.community.setCommunityTx('mzvUgNc8YFk0w5K5H7c8pyT-FC5Y_ba0r7_8766Kx74');
  //       this.isSetTxId = true;
  //     }
  //     await this.community.getState();

  //     let txid = '';
  //     try {
  //       txid = await this.community.transfer(address, 10000);
  //     } catch (e) {
  //       console.log(e);
  //       return res.send('Unable to do the transfer, try again later.');
  //     }

  //     if (referrer && referrer !== address) {
  //       this.community.transfer(referrer, 2000).catch(e => {
  //         console.log(e);
  //       });
  //     }
  //     return res.send(`OK-${txid}`);
  //   }

  //   return res.send('DONE');
  // }
}