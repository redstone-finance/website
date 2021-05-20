import $ from '../libs/jquery';
import BalancesWorker from '../workers/balances';
import VotesWorker from '../workers/votes';
import Utils from '../utils/utils';
import app from '../app';
import arweave from '../libs/arweave';
import Market from '../models/market';
import ActivityTable from '../utils/activityTable';

export default class PageDashboard {
  private prevCall: number;

  async open() {
    // @ts-ignore
    $('[data-toggle="popover"]').popover();
    $('.page-dashboard').show();

    $('.link-home').addClass('active');
    this.syncPageState();
  }

  async close() {
    $('.link-home').removeClass('active');
    $('.page-dashboard').hide();
  }

  public async syncPageState() {
    if (this.prevCall && new Date().getTime() - this.prevCall < 1000 * 60) {
      $('.dimmer').removeClass('active');
      return;
    }
    this.prevCall = new Date().getTime();

    const market = new Market(app.getCommunityId(), await app.getAccount().getWallet());
    if (await app.getAccount().isLoggedIn()) {
      market.showBuyButton();
    } else {
      market.hideBuyButton();
    }

    const state = await app.getCommunity().getState();
    console.log(state);

    const commDesc = state.settings.get('communityDescription') || '';
    const commAppUrl = state.settings.get('communityAppUrl') || '';

    $('.commId').text(app.getCommunityId()).val(app.getCommunityId());
    $('.comm-title').text(state.name).val(state.name);
    $('.comm-description').text(commDesc).val(commDesc);
    $('.app-link').attr('href', commAppUrl).text(commAppUrl).val(commAppUrl);

    const quorum = state.settings.get('quorum') * 100;
    const support = state.settings.get('support') * 100;
    const voteLength = state.settings.get('voteLength');
    const lockMinLength = state.settings.get('lockMinLength');
    const lockMaxLength = state.settings.get('lockMaxLength');

    $('.quorum').text(` ${quorum}%`).val(quorum);
    $('.support').text(` ${support}%`).val(support);
    $('.voteLength').text(` ${Utils.formatNumber(voteLength)} blocks (${Utils.formatBlocks(voteLength)})`).val(voteLength);
    $('.lockMinLength').text(` ${Utils.formatNumber(lockMinLength)} blocks (${Utils.formatBlocks(lockMinLength)})`).val(lockMinLength);
    $('.lockMaxLength').text(` ${Utils.formatNumber(lockMaxLength)} blocks (${Utils.formatBlocks(lockMaxLength)})`).val(lockMaxLength);

    const links = state.settings.get('communityDiscussionLinks');
    if (links && links.length) {
      $('.comm-links').empty();
      links.forEach((link) => {
        $('.comm-links').append(`
        <div class="col-auto">
          <a href="${link}" class="small" target="_blank">${link}</a>
        </div>`);
      });
    }

    let logo = state.settings.get('communityLogo');
    $('.community-logo').val(logo);

    if (logo && logo.length) {
      const config = arweave.api.getConfig();
      logo = `${config.protocol}://${config.host}:${config.port}/${logo}`;
    } else {
      logo = Utils.generateIcon(app.getCommunityId(), 96);
    }
    $('.comm-logo').css('background-image', `url(${logo})`);

    const { users, balance } = await BalancesWorker.usersAndBalance(state.balances);
    const { vaultUsers, vaultBalance } = await BalancesWorker.vaultUsersAndBalance(state.vault);

    let nbUsers = users.length;
    nbUsers += vaultUsers.filter((user) => !users.includes(user)).length;

    $('.users').text(nbUsers).parents('.dimmer').removeClass('active');
    $('.users-vault').text(`${vaultUsers.length} `);

    const votes = await VotesWorker.activeVotesByType(state.votes);
    const votesMint = votes.mint ? votes.mint.length : 0;
    const votesVault = votes.mintLocked ? votes.mintLocked.length : 0;
    const votesActive = votes.active ? votes.active.length : 0;
    const votesAll = votes.all ? votes.all.length : 0;

    $('.minted').text(Utils.formatNumber(balance + vaultBalance));
    $('.mint-waiting').text(`${votesMint} `).parents('.dimmer').removeClass('active');
    $('.vault').text(Utils.formatNumber(vaultBalance));
    $('.vault-waiting').text(`${votesVault} `).parents('.dimmer').removeClass('active');
    $('.ticker').text(` ${state.ticker} `).val(state.ticker);
    $('.votes').text(`${votesActive} `);
    $('.votes-completed')
      .text(`${votesAll - votesActive} `)
      .parents('.dimmer')
      .removeClass('active');

    const activity = new ActivityTable(
      {
        owners: [],
        commId: [app.getCommunityId()],
        cursor: '',
      },
      false,
      10,
    );
    activity.show(true);
  }
}
