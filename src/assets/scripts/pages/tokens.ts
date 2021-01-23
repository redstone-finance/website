import ApexCharts from 'apexcharts';
import { ModuleThread, spawn } from 'threads';

import $ from '../libs/jquery';
import { BalancesWorker } from '../workers/balances';
import { TokensWorker } from '../workers/tokens';
import { StateInterface } from 'community-js/lib/faces';
import Utils from '../utils/utils';
import Toast from '../utils/toast';
import app from '../app';
import Author from '../models/author';
import Market from '../models/market';

export default class PageTokens {
  private chart: ApexCharts;

  // workers
  private firstCall = true;
  private balancesWorker: ModuleThread<BalancesWorker>;
  private tokensWorker: ModuleThread<TokensWorker>;

  constructor() {}

  async open() {
    if (this.firstCall) {
      this.balancesWorker = await spawn<BalancesWorker>(new Worker('../workers/balances.ts'));
      this.tokensWorker = await spawn<TokensWorker>(new Worker('../workers/tokens.ts'));

      this.firstCall = false;
    }

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
    if (await app.getAccount().isLoggedIn()) {
      market.showSellButton();
    } else {
      market.hideSellButton();
    }

    const state = await app.getCommunity().getState();

    const { balance } = await this.balancesWorker.usersAndBalance(state.balances);
    const { vaultBalance } = await this.balancesWorker.vaultUsersAndBalance(state.vault);

    $('.ticker').text(state.ticker);
    $('.minted').text(Utils.formatNumber(balance + vaultBalance));
    $('.minted').parents('.dimmer').removeClass('active');

    const holdersByBalance = await this.tokensWorker.sortHoldersByBalance(state.balances, state.vault);
    this.createOrUpdateCharts(holdersByBalance);
    this.createOrUpdateTable(holdersByBalance, state);

    const bal = await this.balancesWorker.getAddressBalance(
      await app.getAccount().getAddress(),
      state.balances,
      state.vault,
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
    state: StateInterface,
  ): Promise<void> {
    let html = '';

    $('#total-holders').text(`(${holders.length})`);

    for (let i = 0, j = holders.length; i < j; i++) {
      const holder = holders[i];
      const acc = new Author(null, holder.address, null);
      const arId = await acc.getDetails();
      const avatar = arId.avatar;
      const balance =
        holder.balance > holder.vaultBalance
          ? holder.balance - holder.vaultBalance
          : holder.vaultBalance - holder.balance;

      let role = '-';
      if (holder.address in state.roles) {
        role = state.roles[holder.address];
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
      const bal = await this.balancesWorker.getAddressBalance(
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
      if ($target.hasClass('is-invalid') || $balance.hasClass('is-invalid')) {
        return;
      }

      const transferTarget = $target.val().toString().trim();
      const transferBalance = +$balance.val().toString().trim();

      if (isNaN(transferBalance) || transferBalance < 1 || !Number.isInteger(transferBalance)) {
        return;
      }

      $(e.target).addClass('btn-loading disabled');

      try {
        const txid = await app.getCommunity().transfer(transferTarget, transferBalance);
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
