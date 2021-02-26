

import $ from './libs/jquery';
import './global';
import arweave from './libs/arweave';
import { StateInterface } from 'community-js/lib/faces';
import TokensWorker from './workers/tokens';
import Utils from './utils/utils';
import ActivityTable from './utils/activityTable';
import CommunitiesWorker from './workers/communitiesWorker'
import Pager from './utils/pager';

class MemberPage {
  private hash: string;
  private hashes: string[];
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
    this.activityTable = new ActivityTable({
      commId: [],
      owners: [this.hashes[0]],
      cursor: '',
    });

    const address = this.hashes[0];

    $('.avatar').css('background-image', `url(${Utils.generateIcon(address, 72)})`);
    $('h1').text(address);
    $('.viewblock').attr('href', `https://viewblock.io/arweave/address/${address}`);

    arweave.wallets
      .getBalance(address)
      .then((bal) => {
        $('h3').text(`${arweave.ar.winstonToAr(bal, { formatted: true, decimals: 5, trim: true })} AR`);
      })
      .catch(console.log);

    this.activityTable.show();

    const communities: { id: string, state: StateInterface }[] = await CommunitiesWorker.getAllCommunities();
    const commIds: { id: string, state: StateInterface, user: {
      address: string;
      balance: number;
      vaultBalance: number;
    } }[] = [];
    for(const community of communities) {
      const state = community.state;
      const users = (await TokensWorker.sortHoldersByBalance(state.balances, state.vault)).filter((u) => u.address === address);

      if(users.length) {
        commIds.push({id: community.id, state: community.state, user: users[0]});
      }
    }

    $('#total-psc').text(commIds.length);
    const pager = new Pager(commIds, $('.col-12').find('.card-footer'), 10);
    pager.onUpdate((p) => {
      this.loadCommunities(p.items);
    });
    pager.setPage(1);
  }

  private async loadCommunities(commIds: { 
    id: string, 
    state: StateInterface, 
      user: {
      address: string;
      balance: number;
      vaultBalance: number;
    } 
  }[]) {
    $('#balance').find('tbody').remove();

    const address = this.hashes[0];

    $('.loaded').show();

    const list: { html: string; balance: number; vault: number }[] = [];
    let current = -1;
    let completed = 0;

    const go = async (i = 0) => {
      if (i >= commIds.length) {
        return true;
      }

      const community = commIds[i];
      const state: StateInterface = community.state;

      const id = community.id;
      const user = community.user;

      let logo = state.settings['communityLogo'];
      if (logo && logo.length) {
        const config = arweave.api.getConfig();
        logo = `${config.protocol}://${config.host}:${config.port}/${logo}`;
      } else {
        logo = Utils.generateIcon(id, 32);
      }

      list.push({
        html: `
          <tr>
            <td data-label="Community">
              <div class="d-flex lh-sm py-1 align-items-center">
                <span class="avatar mr-2" style="background-image: url(${logo})"></span>
                <div class="flex-fill">
                  <div class="strong">${state.name} (${state.ticker})</div>
                  <a class="text-muted text-h5" href="./index.html#${community.id}" data-community="${community.id}" target="_blank">${community.id}</a>
                </div>
              </div>
            </td>
            <td class="text-muted" data-label="Balance">
              ${Utils.formatNumber(user.balance)}
            </td>
            <td class="text-muted" data-label="Vault Balance">
              ${Utils.formatNumber(user.vaultBalance)}
            </td>
            <td class="text-muted" data-label="Total Balance">
              ${Utils.formatNumber(user.balance + user.vaultBalance)}
            </td>
            <td class="text-muted" data-label="Role">
              ${state.roles[address] ? state.roles[address] : '-'}
            </td>
          </tr>`,
        balance: user.balance,
        vault: user.vaultBalance,
      });

      $('.completed').text(++completed);
      $('.progress-bar').width(`${Math.floor((completed / commIds.length) * 100)}%`);

      return go(++current);
    };

    const gos = [];
    for (let i = 0, j = 5; i < j; i++) {
      gos.push(go(++current));
    }

    await Promise.all(gos);
    $('#loading').remove();
    $('#balance')
      .append(
        `<tbody> 
        ${list
          .sort((a, b) => b.balance + b.vault - (a.balance + a.vault))
          .map((a) => a.html)
          .join('')}
      </tbody>`,
      )
      .show();
  }

  private async events() {
    $(window).on('hashchange', () => {
      this.hashChanged();
    });
    $('.psc-btn').on('click', (e) => {
      e.preventDefault();

      $('.act-btn').removeClass('btn-primary').addClass('btn-secondary');
      $('.psc-btn').removeClass('btn-secondary').addClass('btn-primary');

      $('.act-cards').hide();
      $('.comm-cards').show();
    });
    $('.act-btn').on('click', (e) => {
      e.preventDefault();

      $('.psc-btn').removeClass('btn-primary').addClass('btn-secondary');
      $('.act-btn').removeClass('btn-secondary').addClass('btn-primary');

      $('.comm-cards').hide();
      $('.act-cards').show();
    });
    $('.copy').on('click', (e) => {
      e.preventDefault();
      Utils.copyToClipboard(this.hashes[0]);
    });
  }
}

new MemberPage();
