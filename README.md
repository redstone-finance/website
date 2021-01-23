![Community](https://raw.githubusercontent.com/CommunityXYZ/website/master/src/assets/images/logo.svg)

This is the official website for CommunityXYZ.
You can access the community here: https://community.xyz

### Start it locally
Using yarn (default):
```
yarn install
yarn dev
```

Using NPM:
```
npm i
npm run dev
```
After visit [http://localhost:1234/index.html](http://localhost:1234/index.html).
*Note:* Visiting only `/` wont work as we have many entry points, parcel requires to send the entry point, in this case `/index.html`.


### Permaweb
Starting from version 1.0.2 there's also permaweb versions stored forever on the Arweave network.
Versions will be updated here as soon as a new one is created, by default it will be pointing to arweave().net but you can use any other gateway available for arweave().

```
v1.0.14 - https://arweave.net/P5XdzjUwdwp8iTsXk-ec_-jCzZX4SxRfg_C3jGlPtdI
- added: ArweaveActivity for the jobboard
- added: hide vaults with 0 weight for others
- added: formatnumber and formatblock on missing UI spots
- fix: bug with login, outdated arweave-js

v1.0.13 - https://arweave.net/0jZx2GZt-48sEoXkbByRjWLBz4MuVbUh1toJggs_88U
- Activity board for Communities and members
- New members profile with activity and tokens owned
- Solved issue with multi-loading of the dashboard on first entry
- Members address links to the member profile
- Logged in member can now see the AR balance of the account by clicking on the wallet address (header, right-side)

v1.0.12 - https://arweave.net/536IoIKHRA26ZVgUGVCWUN9fEVjKF0FSe3bhHYVH2d4
- Single transaction for fee + contract call
- Better description on each call
- Prettier for Typescript

v1.0.11 - https://arweave.net/UvRDOGKT-OrEI5AC9D9lMCuWqsWVvlXqNZfK690DKGA
- Uses speedweave first release.

v1.0.10 - https://arweave.dev/_pI6sdZF8IGckkdmnNtQ_JJDNiJEg5aPRJJNu2NCUD4
- Global Arweave instance
- Opps in each Community dashboard
- Start payout vote from the Opps page
- Global accounts so we don't lose login session
- Communities page
- Solved bug with tooltips

v1.0.9
- Reduced load time from 30s-1m to 5s-15s
- Updated opps structure to include applicants and authors
- Better structure for Arweave instance
- Caching system for opportunities and applicants
- Approve an applicant and highlight the applicant's card

v1.0.8 - https://arweave.net/kOqu-l5K2u4PKSDf2adHYot0b_9IZHmWEwvLGyVr4LU
- GQL integration for faster interaction with transactions
- New status system that works with a non-intrusive popup
- Increased performance
- Solved chart bug for the "Tokens" tab 

v1.0.5 - https://arweave.net/b5GCwZgWIzXygw-N-X-gROGx2buSOUv3mf92fo29EMU
- Opportunity / Job board

v1.0.4 - https://arweave.net/LS2Y7bPvGfRjn9LIt2twYD_6Wu5Le71u9OHxJGN3P6M
- Changed wording on landing page

v1.0.3 - https://arweave.net/z1pAkQOJFxmzZ_nNLFR3upHa2Iw0UCZUFBYGp_q-oSI
- Actions on the tokens buttons

v1.0.2 - https://arweave.net/1zQ6RPw2LW0FM-fc44AdAOn_5elndRVlzuKJ7s-91C4
- First deploy to Arweave
```