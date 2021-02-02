import express from 'express';
import path from 'path';
import Arweave from 'arweave';
import mongoose from 'mongoose';
import Community from 'community-js';
import { pages } from '../pages';

const Account = mongoose.model('Account', {
  // @ts-ignore
  addy: {type: String, unique: true},
  referrer: {type: String, index: true},
  firstTx: Number,
  lastTx: Number,
  date: { type: Date, default: Date.now }
});

const wallet = process.env.WALLET;

export default class HomeController {
  path = '/';
  router = express.Router();
  
  private isSetTxId = false;
  private arweave: Arweave;
  private community: Community;
  
  constructor(arweave: Arweave) {
    this.arweave = arweave;
    this.community = new Community(arweave, JSON.parse(wallet));
    this.initRoutes();
  }

  private initRoutes() {
    this.router.get(this.path, (_, res) => {
      res.sendFile(path.join(__dirname, '../../dist/index.html')); 
    });

    for(const page of pages) {
      this.router.get(`${this.path}${page}`, (_, res) => {
        res.sendFile(path.join(__dirname, `../../dist/${page}.html`));
      });
    }

    this.router.get(`${this.path}chat`, (_, res) => {
      res.redirect('https://discord.gg/5SMgD9t');
    });

    this.router.get(`${this.path}completeclaim`, (_, res) => {
      res.redirect('./claim');
    });

    this.router.post(`${this.path}completeclaim`, (req, res) => {
      return this.completeClaim(req, res);
    });
  }

  private async completeClaim(req: express.Request, res: express.Response) {
    if(!req.body || !req.body.wallet) {
      return res.send('Invalid data.');
    }
  
    let address = '';
    let referrer = req.body.ref || '';
  
    try {
      address = await this.arweave.wallets.jwkToAddress(req.body.wallet);
    } catch (err) {
      return res.send('Invalid params.');
    }
  
    if(!/[a-z0-9_-]{43}/i.test(address)) {
      return res.send('Invalid address provided.');
    }
  
    if(referrer.length) {
      referrer = referrer.toString().trim();
    }
    if(!/[a-z0-9_-]{43}/i.test(referrer)) {
      referrer = '';
    }
  
    let account = null;
    try {
      account = await Account.findOne({ addy: address });
    } catch (err) {
      console.log(err);
      return res.send('Unable to connect, contact the admin.');
    }
  
    if(!account) {
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
  
      let firstTx = '';
      let lastTx = '';
      try {
        const r = await this.arweave.api.post('/graphql', {query: queryFirstTx});
        firstTx = r.data.data.transactions.edges[0].node.block.height;
      } catch (e) {
        return res.send('You don\'t have any data tx before block 551,000.');
      }
      
      try {
        const r = await this.arweave.api.post('/graphql', {query: queryLastTx});
        lastTx = r.data.data.transactions.edges[0].node.block.height;
      } catch (e) {
        return res.send('You don\'t have any data tx before block 551,000.');
      }
  
      // Save the account
      account = new Account({
        addy: address,
        referrer: referrer,
        firstTx,
        lastTx
      });
      try {
        await account.save();
      } catch (err) {
        console.log(err);
        return res.send('Unable to connect, contact the admin.');
      }
  
      // Send the tokens
      if(!this.isSetTxId) {
        await this.community.setCommunityTx('mzvUgNc8YFk0w5K5H7c8pyT-FC5Y_ba0r7_8766Kx74');
        this.isSetTxId = true;
      }
      await this.community.getState();
  
      let txid = '';
      try {
        txid = await this.community.transfer(address, 10000);
      } catch(e) {
        console.log(e);
        return res.send('Unable to do the transfer, try again later.');
      }
  
      if(referrer && referrer !== address) {
        this.community.transfer(referrer, 2000).catch(e => {
          console.log(e);
        });
      }
      return res.send(`OK-${txid}`);
    }
  
    return res.send('DONE');
  }
}