import '../../styles/style.scss';

import 'threads/register';
import $ from '../libs/jquery';
import 'bootstrap/dist/js/bootstrap.bundle';

import '../global';
import PageJobs from './jobs';
import PageJob from './job';
import Account from '../models/account';
import Community from 'community-js';
import PageCreateJob from './create';
import Transaction from 'arweave/node/lib/transaction';
import Statusify from '../utils/statusify';
import Toast from '../utils/toast';
import Opportunities from '../models/opportunities';
import arweave from '../libs/arweave';

class JobBoard {
  private hash: string;
  private hashes: string[];
  private community: Community;
  private account: Account;
  private statusify: Statusify;
  private opportunities: Opportunities;

  private firstCall = true;
  private fee = '';

  // Pages
  protected currentPage: PageJobs | PageJob | PageCreateJob; // Add all possible page objects here
  private pageJobs: PageJobs;
  private pageJob: PageJob;
  private pageCreateJob: PageCreateJob;

  getHashes(): string[] {
    return this.hashes;
  }
  getCurrentPage(): PageJob | PageJobs | PageCreateJob {
    return this.currentPage;
  }
  getCommunity(): Community {
    return this.community;
  }
  getAccount(): Account {
    return this.account;
  }
  getStatusify(): Statusify {
    return this.statusify;
  }
  getFee(): string {
    return this.fee;
  }
  getOpportunities(): Opportunities {
    return this.opportunities;
  }

  async getPageStr(): Promise<string> {
    return this.hashes[0] || 'home';
  }

  constructor() {
    this.community = new Community(arweave);
    this.account = new Account(this.community);
    this.statusify = new Statusify();

    this.opportunities = new Opportunities();
    this.pageJobs = new PageJobs();
    this.pageJob = new PageJob();
    this.pageCreateJob = new PageCreateJob();

    this.hashChanged(false);
  }

  async init() {
    if (!this.firstCall) {
      return;
    }
    this.firstCall = false;

    await this.updateFee();
    await this.account.init();
    $('body').fadeIn();

    await this.pageChanged();
    this.events();
  }

  async setCommunityTx(txid: string) {
    this.community = new Community(arweave);
    return this.community.setCommunityTx(txid);
  }

  async getChargeFee(): Promise<{ target: string; winstonQty: string }> {
    const balance = await arweave.wallets.getBalance(await this.account.getAddress());

    if (+balance < +this.fee) {
      const toast = new Toast();
      toast.show('Not enought balance', "You don't have enough balance for this transaction.", 'error', 3000);
      return null;
    }

    await this.community.setCommunityTx(await this.community.getMainContractId());
    const target = await this.community.selectWeightedHolder();
    if (target === (await this.account.getAddress())) {
      return {
        target: '',
        winstonQty: '',
      };
    }

    return {
      target,
      winstonQty: arweave.ar.arToWinston(this.fee),
    };
  }

  private async updateFee() {
    this.fee = await this.community.getActionCost(true, { formatted: true, decimals: 5, trim: true });
    $('.action-fee').text(this.fee);

    setTimeout(() => this.updateFee(), 60000);
  }

  private async hashChanged(updatePage = true) {
    this.hash = location.hash.substr(1);
    const hashes = this.hash.split('/');

    this.hashes = hashes;

    if (updatePage) {
      await this.pageChanged();
    }
  }

  private async pageChanged() {
    $('.dimmer').addClass('active');

    if (this.currentPage) {
      this.currentPage.close();
    }

    let page = await this.getPageStr();
    if (page === 'create' && !(await this.account.isLoggedIn())) {
      window.location.hash = '';
    }

    if (page === 'home') {
      this.currentPage = this.pageJobs;
    } else if (page === 'create') {
      this.currentPage = this.pageCreateJob;
    } else {
      this.currentPage = this.pageJob;
    }

    // @ts-ignore
    window.currentPage = this.currentPage;

    await this.updateTxFee();
    await this.currentPage.open();
  }

  private async updateTxFee() {
    const fee = await this.community.getActionCost(true, { formatted: true, decimals: 5, trim: true });
    $('.tx-fee').text(fee);

    setTimeout(() => this.updateTxFee(), 60000);
  }

  private async events() {
    $(window).on('hashchange', () => {
      this.hashChanged();
    });

    $(document).on('input', '.input-number', (e: any) => {
      const $target = $(e.target);
      const newVal = +$target
        .val()
        .toString()
        .replace(/[^0-9]/g, '');
      $target.val(newVal);

      if ($target.hasClass('percent') && newVal > 99) {
        $target.val(99);
      }
    });
  }
}
const jobboard = new JobBoard();
export default jobboard;

$(document).ready(() => {
  jobboard.init();
});
