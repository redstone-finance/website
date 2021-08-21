import ApexCharts from 'apexcharts';
import * as esprima from 'esprima';
import $ from '../libs/jquery';
import { StateInterface } from 'community-js/lib/faces';
import Utils from '../utils/utils';
import Toast from '../utils/toast';
import app from '../app';
import Author from '../models/author';
import Market from '../models/market';
import BalancesWorker from '../workers/balances';
import TokensWorker from '../workers/tokens';
import Pager from '../utils/pager';
import arweave, { ardb } from '../libs/arweave';
import { GQLEdgeTransactionInterface } from 'ardb/lib/faces/gql';

export default class PageTokens {
  private chart: ApexCharts;
  private limit: number = 10;
  private state: StateInterface;
  private currentPage: number = 1;
  private hasTransferLocked: boolean = false;

  async open() {
    $('.link-tokens').addClass('active');
    $('.page-tokens').show();
    this.syncPageState();

    this.events();
  }

  async close() {
    await this.removeEvents();

    $('.link-tokens').removeClass('active');
    $('.page-tokens').hide();
  }

  public async syncPageState() {
    const market = new Market(app.getCommunityId(), await app.getAccount().getWallet());

    this.state = await app.getCommunity().getState();

    if (await app.getAccount().isLoggedIn()) {
      market.showSellButton();
    } else {
      market.hideSellButton();
    }

    this.hasTransferLocked = false;

    let contractSrc: string;
    if (this.state.settings.get('evolve')) {
      contractSrc = this.state.settings.get('evolve');
    } else {
      try {
        const edge = (await ardb
          .search('transactions')
          .id(app.getCommunityId())
          .only(['tags', 'tags.name', 'tags.value'])
          .findOne()) as GQLEdgeTransactionInterface[];
        contractSrc = edge[0].node.tags.filter((t) => t.name === 'Contract-Src')[0].value;
      } catch (e) {
        console.log(e);
      }
    }

    console.log(contractSrc);
    try {
      const { data } = await arweave.api.get(contractSrc);
      const res = esprima.tokenize(data);

      for (let i = 0, j = res.length; i < j; i++) {
        if (res[i].type === 'Keyword' && res[i].value === 'function') {
          if (res[i + 1].type === 'Punctuator' && (res[i + 1].value === '===' || res[i + 1].value === '==')) {
            if (
              res[i + 2].type === 'String' &&
              (res[i + 2].value === '"transferLocked"' || res[i + 2].value === '"transferLocked"')
            ) {
              this.hasTransferLocked = true;
              break;
            }
          }
        }
      }
    } catch (e) {}

    if (this.hasTransferLocked) {
      $('#transfer-lock').show();
    } else {
      $('#transfer-lock').hide();
    }

    const { balance } = await BalancesWorker.usersAndBalance(this.state.balances);
    const { vaultBalance } = await BalancesWorker.vaultUsersAndBalance(this.state.vault);

    $('.ticker').text(this.state.ticker);
    $('.minted').text(Utils.formatNumber(balance + vaultBalance));
    $('.minted').parents('.dimmer').removeClass('active');

    const lockMinLength = this.state.settings.get('lockMinLength');
    const lockMaxLength = this.state.settings.get('lockMaxLength');

    $('.min-lock-length').text(Utils.formatNumber(lockMinLength));
    $('.max-lock-length').text(Utils.formatNumber(lockMaxLength));

    const holdersByBalance = await TokensWorker.sortHoldersByBalance(this.state.balances, this.state.vault);
    const holders = holdersByBalance.filter((holder) => /[a-z0-9_-]{43}/i.test(holder.address));

    this.createOrUpdateCharts(holders);
    const pager = new Pager(holders, $('.tokens-list').find('.card-footer'), 10);
    pager.onUpdate((p) => {
      console.log(p);
      this.createOrUpdateTable(p.items);
    });
    pager.setPage(1);

    const bal = await BalancesWorker.getAddressBalance(
      await app.getAccount().getAddress(),
      this.state.balances,
      this.state.vault,
    );
    $('.user-total-balance').text(Utils.formatNumber(bal.balance));
    $('.user-unlocked-balance').text(Utils.formatNumber(bal.unlocked));

    const transferFee = await app.getCommunity().getActionCost(true, { formatted: true, decimals: 5, trim: true });
    $('.tx-fee').text(` ${transferFee} `);
  }

  private async createOrUpdateTable(
    holders: {
      address: string;
      balance: number;
      vaultBalance: number;
    }[],
  ): Promise<void> {
    let html = '';

    $('#total-holders').text(`(${holders.length})`);

    for (const holder of holders) {
      const acc = new Author(null, holder.address, null);
      const arId = await acc.getDetails();
      const avatar = arId.avatar;
      const balance =
        holder.balance > holder.vaultBalance
          ? holder.balance - holder.vaultBalance
          : holder.vaultBalance - holder.balance;

      let role = '-';
      if (holder.address in this.state.roles) {
        role = this.state.roles[holder.address];
      }

      html += `<tr data-holder='${JSON.stringify(holder)}'>
        <td data-label="Token Holder">
          <div class="d-flex lh-sm py-1 align-items-center">
            <span class="avatar mr-2" style="background-image: url(${avatar})"></span>
            <div class="flex-fill">
              <div class="strong">${arId.name || holder.address}</div>
              <a href="./member.html#${holder.address}" target="_blank" class="text-muted text-h5">${holder.address}</a>
            </div>
          </div>
        </td>
        <td class="text-muted" data-label="Balance">
          ${Utils.formatNumber(balance)}
        </td>
        <td class="text-muted" data-label="Vault Balance">${Utils.formatNumber(holder.vaultBalance)}</td>
        <td class="text-muted" data-label="Total Balance">${Utils.formatNumber(holder.balance)}</td>
        <td class="text-muted d-none d-lg-table-cell" data-label="Role">${role}</td>
        <td class="text-right">
          <span class="dropdown ml-1">
            <button class="btn btn-light dropdown-toggle align-text-top" data-boundary="viewport" data-toggle="dropdown">Actions</button>
            <div data-addy="${holder.address}" class="dropdown-menu dropdown-menu-right">
              <a class="transfer-user dropdown-item" href="#">Transfer</a>
              <a class="mint-user dropdown-item" href="#">Mint</a>
              <a class="burn-vault-user dropdown-item" href="#">Burn</a>
            </div>
          </span>
        </td>
      </tr>`;
    }

    $('.token-holders').find('tbody').html(html).parents('.dimmer').removeClass('active');
  }

  private async createOrUpdateCharts(holders: { address: string; balance: number }[]) {
    if (!this.chart) {
      this.chart = new ApexCharts(document.getElementById('chart-total-tokens'), {
        chart: {
          type: 'donut',
          fontFamily: 'inherit',
          height: 216,
          sparkline: {
            enabled: true,
          },
          animations: {
            enabled: true,
          },
        },
        fill: { opacity: 1 },
        title: {
          text: 'Top holders',
        },
        labels: [],
        series: [],
        noData: {
          text: 'Loading...',
        },
        grid: {
          strokeDashArray: 4,
        },
        colors: ['#206bc4', '#79a6dc', '#bfe399', '#e9ecf1'],
        legend: { show: false },
        tooltip: { fillSeriesColor: false },
        yaxis: {
          labels: {
            formatter: (val) => `${val}%`,
          },
        },
      });
      this.chart.render();
    }

    const labels: string[] = [];
    const series: number[] = [];

    const maxChartHolders = holders.length > 5 ? 5 : holders.length;

    let totalBalance = 0;
    for (let i = 0, j = holders.length; i < j; i++) {
      totalBalance += holders[i].balance;
    }

    for (let i = 0, j = maxChartHolders; i < j; i++) {
      labels.push(holders[i].address);
      series.push(Math.round((holders[i].balance / totalBalance) * 100));
    }

    this.chart.updateSeries(series);
    this.chart.updateOptions({
      labels,
    });

    $('#chart-total-tokens').parents('.dimmer').removeClass('active');
  }

  private async events() {
    $('.btn-max-balance').on('click', async (e: any) => {
      e.preventDefault();

      const state = await app.getCommunity().getState();
      const bal = await BalancesWorker.getAddressBalance(
        await app.getAccount().getAddress(),
        state.balances,
        state.vault,
      );

      $('.input-max-balance').val(bal.unlocked);
    });

    $('.do-transfer-tokens').on('click', async (e: any) => {
      e.preventDefault();

      if (!(await app.getAccount().isLoggedIn())) {
        // @ts-ignore
        $('#modal-transfer').modal('hide');
        return app.getAccount().showLoginError();
      }

      const $target = $('#transfer-target');
      const $balance = $('#transfer-balance');
      const $transferLock = $('#transfer-lock-length');
      if ($target.hasClass('is-invalid') || $balance.hasClass('is-invalid')) {
        return;
      }

      const transferTarget = $target.val().toString().trim();
      const transferBalance = +$balance.val().toString().trim();
      const transferLock = this.hasTransferLocked ? +$transferLock.val().toString().trim() : 0;

      if (isNaN(transferBalance) || transferBalance < 1 || !Number.isInteger(transferBalance)) {
        return;
      }

      $(e.target).addClass('btn-loading disabled');

      try {
        let txid;
        if (transferLock > 0) {
          txid = await app.getCommunity().transferLocked(transferTarget, transferBalance, transferLock);
        } else {
          txid = await app.getCommunity().transfer(transferTarget, transferBalance);
        }

        app
          .getStatusify()
          .add('Transfer balance', txid)
          .then(async () => {
            await app.getCommunity().getState(false);
            app.getCurrentPage().syncPageState();
          });
      } catch (err) {
        console.log(err.message);
        const toast = new Toast();
        toast.show('Transfer error', err.message, 'error', 3000);
      }

      // @ts-ignore
      $('#modal-transfer').modal('hide');
      $(e.target).removeClass('btn-loading disabled');
    });

    $('#transfer-target').on('input', async (e: any) => {
      const $target = $(e.target);
      const transferTarget = $target.val().toString().trim();
      if (!(await Utils.isArTx(transferTarget)) || transferTarget === (await app.getAccount().getAddress())) {
        $target.addClass('is-invalid');
      } else {
        $target.removeClass('is-invalid');
      }
    });

    $(document).on('click', '.transfer-user', (e: any) => {
      e.preventDefault();

      const addy = $(e.target).parent().attr('data-addy');
      $('#transfer-target').val(addy.trim());
      $('#transfer-balance').val(0);

      // @ts-ignore
      $('#modal-transfer').modal('show');
    });

    $(document).on('click', '.mint-user, .mint-locked-user, .burn-vault-user', (e: any) => {
      e.preventDefault();

      const addy = $(e.target).parent().attr('data-addy').trim();

      if ($(e.target).hasClass('mint-user')) {
        $('input[name="voteType"][value="mint"]').trigger('click');
        $('#vote-recipient').val(addy);
      } else if ($(e.target).hasClass('mint-locked-user')) {
        $('input[name="voteType"][value="mintLocked"]').trigger('click');
        $('#vote-recipient').val(addy);
      } else if ($(e.target).hasClass('burn-vault-user')) {
        $('input[name="voteType"][value="burnVault"]').trigger('click');
        $('#vote-target').val(addy);
      }

      // @ts-ignore
      $('#modal-new-vote').modal('show');
    });

    await app.getPageVotes().validateVotes();
  }

  private async removeEvents() {
    $('.btn-max-balance, .do-transfer-tokens').off('click');
    $('#transfer-target').off('input');
    $(document).off('click', '.transfer-user, .mint-user, .mint-locked-user, .burn-vault-user');

    await app.getPageVotes().removeValidateVotes();
  }
}
