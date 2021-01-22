import 'threads/register';

import '../styles/style.scss';
import $ from './libs/jquery';
import './global';
import arweave from './libs/arweave';
import Community from 'community-js';
import GQLResultInterface from './interfaces/gqlResult';
import { StateInterface } from 'community-js/lib/faces';
import { ModuleThread, spawn } from 'threads';
import { TokensWorker } from './workers/tokens';
import Utils from './utils/utils';
import ActivityTable from './utils/activityTable';
import { run } from 'ar-gql';

class MemberPage {
  private hash: string;
  private hashes: string[];
  private cursor: string = '';
  private currentPage: number = 1;
  private activityTable: ActivityTable;

  constructor() {
    this.hashChanged();
    this.events();
  }

  private async hashChanged(updatePage = true) {
    this.hash = location.hash.substr(1);
    const hashes = this.hash.split('/');
    if (this.hashes && this.hashes[0] !== hashes[0]) {
      window.location.reload();
    }

    this.hashes = hashes;

    // To be able to access the dashboard, you need to send a Community txId.
    if (!this.hashes.length || !/^[a-z0-9-_]{43}$/i.test(this.hashes[0])) {
      window.location.href = './home.html';
    }

    if (updatePage) {
      await this.pageChanged();
    }
  }

  private async pageChanged() {
    this.activityTable = new ActivityTable(`
      query($owners: [String!]!, $cursor: String!) {
        transactions(
          owners: $owners
          tags: [
            { name: "Type", values: "ArweaveActivity" }
          ]
          first: 10
          after: $cursor
        ) {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              tags {
                name
                value
              }
              owner {
                address
              }
              block {
                timestamp
              }
            }
          }
        }
      }
    `, {
      owners: [this.hashes[0]],
      cursor: this.cursor
    });
  
    const address = this.hashes[0];
    
    $('.avatar').css('background-image', `url(${Utils.generateIcon(address, 72)})`);
    $('h1').text(address);
    $('.viewblock').attr('href', `https://viewblock.io/arweave/address/${address}`);
  
    arweave.wallets.getBalance(address).then(bal => {
      $('h3').text(`${arweave.ar.winstonToAr(bal, { formatted: true, decimals: 5, trim: true})} AR`);
    }).catch(console.log);
  
  
    this.activityTable.show();
    this.loadCommunities();
  }

  private async loadCommunities() {
    $('#balance').find('tbody').remove();

    const tokensWorker: ModuleThread<TokensWorker> = await spawn<TokensWorker>(new Worker('./workers/tokens.ts'));
    const commIds: string[] = await this.getAllCommunityIds();
    const address = this.hashes[0];

    $('.loaded').show();

    let list: { html: string; balance: number; vault: number; }[] = [];
    let current = -1;
    let completed = 0;

    const go = async (i = 0) => {
      if (i >= commIds.length) {
        return true;
      }

      const comm = commIds[i];
      let state: StateInterface;

      try {
        const community = new Community(arweave);
        await community.setCommunityTx(comm);
        state = await community.getState(true);
      } catch (e) {
        return go(++current);
      }

      const users = (await tokensWorker.sortHoldersByBalance(state.balances, state.vault)).filter(u => u.address === address);
      if(!users.length) {
        return go(++current);
      }
      const user = users[0];

      let logo = state.settings.get('communityLogo');
      if (logo && logo.length) {
        const config = arweave.api.getConfig();
        logo = `${config.protocol}://${config.host}:${config.port}/${logo}`;
      } else {
        logo = Utils.generateIcon(comm, 32);
      }

      list.push({
        html: `
          <tr>
            <td data-label="Community">
              <div class="d-flex lh-sm py-1 align-items-center">
                <span class="avatar mr-2" style="background-image: url(${logo})"></span>
                <div class="flex-fill">
                  <div class="strong">${state.name} (${state.ticker})</div>
                  <a class="text-muted text-h5" href="./index.html#${comm}" data-community="${comm}" target="_blank">${comm}</a>
                </div>
              </div>
            </td>
            <td class="text-muted" data-label="Balance">
              ${Utils.formatMoney(user.balance, 0)}
            </td>
            <td class="text-muted" data-label="Vault Balance">
              ${Utils.formatMoney(user.vaultBalance, 0)}
            </td>
            <td class="text-muted" data-label="Total Balance">
              ${Utils.formatMoney((user.balance + user.vaultBalance), 0)}
            </td>
            <td class="text-muted" data-label="Role">
              ${state.roles[address]? state.roles[address] : '-'}
            </td>
          </tr>`,
        balance: user.balance,
        vault: user.vaultBalance
      });

      $('.completed').text(++completed);
      $('.progress-bar').width(`${Math.floor((completed / commIds.length) * 100)}%`);

      return go(++current);
    }

    const gos = [];
    for (let i = 0, j = 5; i < j; i++) {
      gos.push(go(++current));
    }

    await Promise.all(gos);
    $('#loading').remove();
    $('#balance').append(
      `<tbody> 
        ${list.sort((a, b) => b.balance + b.vault - (a.balance + a.vault)).map((a) => a.html).join('')}
      </tbody>`
    ).show();

    $('#total-psc').text(` (${list.length})`);
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
  
    return ids;
  }

  private async events() {
    $(window).on('hashchange', () => {
      this.hashChanged();
    });
    $('.psc-btn').on('click', e => {
      e.preventDefault();

      $('.act-btn').removeClass('btn-primary').addClass('btn-secondary');
      $('.psc-btn').removeClass('btn-secondary').addClass('btn-primary');

      $('.act-cards').hide();
      $('.comm-cards').show();
    });
    $('.act-btn').on('click', e => {
      e.preventDefault();

      $('.psc-btn').removeClass('btn-primary').addClass('btn-secondary');
      $('.act-btn').removeClass('btn-secondary').addClass('btn-primary');

      $('.comm-cards').hide();
      $('.act-cards').show();
    });
    $('.copy').on('click', e => {
      e.preventDefault();
      Utils.copyToClipboard(this.hashes[0]);
    });

    $('.next').on('click', e => {
      e.preventDefault();

      if($('.next').parent().hasClass('disabled')) return;

      this.currentPage++;
      this.loadActivity();
    });
    $('.prev').on('click', e => {
      e.preventDefault();

      if($('.prev').parent().hasClass('disabled')) return;

      this.cursor = '';

      this.currentPage = 1;
      this.loadActivity();
    });
  }
}

new MemberPage();