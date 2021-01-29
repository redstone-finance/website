const mongoose = require('mongoose');
const express = require("express");
const path = require('path');
const Arweave = require('arweave');
const Community = require('community-js').default;

mongoose.connect(process.env.MONGO_URL, {useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true});
const app = express();
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

const wallet = process.env.WALLET;
const community = new Community(arweave, JSON.parse(wallet));

let isSetTxId = false;

const Account = mongoose.model('Account', {
  addy: {type: String, unique: true},
  referrer: {type: String, index: true},
  firstTx: Number,
  lastTx: Number,
  date: { type: Date, default: Date.now }
});

app.use(express.urlencoded({
  extended: true
}));

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html')); 
});

app.get('/index.html', (_, res) => {
  res.redirect('/');
});

app.get('/create.html', (_, res) => {
  res.redirect('/create');
});

app.get('/home.html', (_, res) => {
  res.redirect('/home');
});

app.get('/opportunity.html', (_, res) => {
  res.redirect('/opportunity');
});

app.get('/communities.html', (_, res) => {
  res.redirect('/communities');
});

app.get('/claim.html', (_, res) => {
  res.redirect('/claim');
});

app.get('/member.html', (_, res) => {
  res.redirect('/member');
});

app.get('/opportunity', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist/opportunity.html'));
});

app.get('/create', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist/create.html'));
});

app.get('/home', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist/home.html'));
});

app.get('/communities', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist/communities.html'));
});

app.get('/member', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist/member.html'));
});

app.get('/claim', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist/claim.html'));
});

app.get('/completeclaim', async (req, res) => {
  res.redirect('./claim.html');
});

app.post('/completeclaim', async (req, res) => {
  if(!req.body || !req.body.wallet) {
    return res.send('Invalid data.');
  }

  let address = '';
  let referrer = req.body.ref || '';

  try {
    address = await arweave.wallets.jwkToAddress(req.body.wallet);
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

  let account = false;
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
      const r = await arweave.api.post('/graphql', {query: queryFirstTx});
      firstTx = r.data.data.transactions.edges[0].node.block.height;
    } catch (e) {
      return res.send('You don\'t have any data tx before block 551,000.');
    }
    
    try {
      const r = await arweave.api.post('/graphql', {query: queryLastTx});
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
    if(!isSetTxId) {
      await community.setCommunityTx('mzvUgNc8YFk0w5K5H7c8pyT-FC5Y_ba0r7_8766Kx74');
      isSetTxId = true;
    }
    await community.getState();

    let txid = '';
    try {
      txid = await community.transfer(address, 10000);
    } catch(e) {
      console.log(e);
      return res.send('Unable to do the transfer, try again later.');
    }

    if(referrer && referrer !== address) {
      community.transfer(referrer, 2000).catch(e => {
        console.log(e);
      });
    }
    return res.send(`OK-${txid}`);
  }

  return res.send('DONE');
});

app.get('/chat', (_, res) => {
  res.redirect('https://discord.gg/5SMgD9t');
});


app.use(express.static('dist'));
app.listen((process.env.PORT || 8080), (process.env.HOST || '0.0.0.0'), () => console.log('ready on port 8080'));