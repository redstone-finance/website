import feather from 'feather-icons';

import $ from '../libs/jquery';
import { VoteInterface, VoteStatus, VoteType, StateInterface } from 'community-js/lib/faces';
import app from '../app';
import Utils from '../utils/utils';
import Toast from '../utils/toast';
import Author from './author';
import arweave from '../libs/arweave';

export default class Vote implements VoteInterface {
  status?: VoteStatus;
  type?: VoteType;
  id?: number;
  totalWeight?: number;
  recipient?: string;
  target?: string;
  qty?: number;
  key?: string;
  value?: any;
  note?: string;
  yays?: number;
  nays?: number;
  voted?: string[];
  start?: number;
  lockLength?: number;

  private voteId: number;
  private $card: any;
  private keepSync = true;

  constructor(params: VoteInterface = {}, voteId: number) {
    if (Object.keys(params).length) {
      params = Utils.stripTags(params);
      for (const key in params) {
        this[key] = params[key];
      }
    }

    this.voteId = voteId;
  }

  public getVoteId(): number {
    return this.voteId;
  }
  public getJQueryCard() {
    return this.$card;
  }

  async sync(cached = true, recall = false) {
    // TODO: Continue
    const state = await app.getCommunity().getState(cached);

    let params = state.votes[this.voteId];
    if (Object.keys(params).length) {
      params = Utils.stripTags(params);
      for (const key in params) {
        this[key] = params[key];
      }
    }

    this.syncYaysNays();
    this.syncAvatarList();

    const endsIn = await this.syncBlocksProgress(state);
    this.syncFooterButtons(state, endsIn);

    if (endsIn > 0 && this.status !== 'active' && recall && this.keepSync) {
      setTimeout(() => this.sync(true, recall), 60000);
    }
  }

  async show() {
    const state = await app.getCommunity().getState();
    const ends = +this.start + state.settings.get('voteLength');
    const current = app.getCurrentBlock();

    let percent = 100;
    if (current < ends) {
      percent = ((current - this.start) / (ends - this.start)) * 100;
    }

    const bgColor =
      this.type === 'mint'
        ? 'lime'
        : this.type === 'mintLocked'
        ? 'green'
        : this.type === 'burnVault'
        ? 'red'
        : this.type === 'set'
        ? 'blue'
        : 'yellow';
    const icon =
      this.type === 'mint'
        ? feather.icons.users.toSvg()
        : this.type === 'mintLocked' || this.type === 'burnVault'
        ? feather.icons.lock.toSvg()
        : this.type === 'set'
        ? feather.icons.settings.toSvg()
        : feather.icons['help-circle'].toSvg();

    let details = '';
    if (this.type === 'mint' || this.type === 'mintLocked' || this.type === 'burnVault') {
      const acc = new Author(null, this.recipient || this.target, null);
      const arId = await acc.getDetails();

      details = `
      <div class="mb-3">
        <h3 class="mb-0">${this.type === 'burnVault' ? 'Target' : 'Recipient'}</h3>
        <div class="d-flex lh-sm py-1 align-items-center">
          <span class="avatar mr-2" style="background-image: url(${arId.avatar})"></span>
          <div class="flex-fill">
            <div class="strong">${arId.name || this.recipient || this.target}</div>
            <a href="./member.html#${this.recipient || this.target}" target="_blank" class="text-muted text-h5">${
        this.recipient || this.target
      }</a>
          </div>
        </div>
      </div>`;
    }
    if (this.type === 'mint' || this.type === 'mintLocked') {
      details += `
      <div class="mb-3">
        <h3 class="mb-0">Quantity</h3>
        <p class="text-muted">${Utils.formatNumber(this.qty)} ${state.ticker}</p>
      </div>`;
    }
    if (this.type === 'mintLocked') {
      details += `
      <div class="mb-3">
        <h3 class="mb-0">Lock length</h3>
        <p class="text-muted">${Utils.formatNumber(this.lockLength)} blocks (${Utils.formatBlocks(this.lockLength)})</p>
      </div>`;
    }
    if (this.type === 'set') {
      let val = this.value;
      console.log(this.key);
      if (this.key === 'quorum' || this.key === 'support') {
        val = `${this.value * 100}%`;
      } else if (this.key === 'communityLogo') {
        const config = arweave.api.getConfig();
        val = `<img src="${config.protocol}://${config.host}:${config.port}/${this.value}" style="height: 120px; width: auto;">`;
      } else if (this.key === 'lockMaxLength' || this.key === 'lockMinLength') {
        val = `${Utils.formatNumber(val)} blocks (${Utils.formatBlocks(val)})`;
      }

      details += `
      <div class="mb-3">
        <h3 class="mb-0">Key</h3>
        <p class="text-muted">${await Utils.capitalize(this.key)}</p>
      </div>
      <div class="mb-3">
        <h3 class="mb-0">Value</h3>
        <p class="text-muted">${val}</p>
      </div>`;
    }

    this.$card = $(`<div class="col-md-6">
      <div class="card vote-${this.voteId}">
        <div class="progress progress-sm card-progress" data-toggle="tooltip" data-placement="top">
          <div class="progress-bar blocks-progress" role="progressbar">
            <span class="sr-only"></span>
          </div>
        </div>
        <div class="card-body">
          <div class="float-right stamp bg-${bgColor} text-white">${icon}</div>
          <div class="text-muted font-weight-normal mt-0 mb-3">#${this.voteId}. ${await Utils.capitalize(
      this.type,
    )}</div>
          ${details}
          <div class="mb-3">
            <h3 class="mb-0">Note</h3>
            <p class="text-muted">${this.note}</p>
          </div>
          <div class="mb-3">
            <div class="row align-items-center">
              <div class="col text-muted">Yes</div>
              <div class="txt-yays col-auto ml-auto text-muted"></div>
            </div>
            <div class="progress">
              <div class="progress-bar progress-yays bg-green"></div>
            </div>
          </div>
          <div class="mb-3">
            <div class="row align-items-center">
              <div class="col text-muted">No</div>
              <div class="txt-nays col-auto ml-auto text-muted"></div>
            </div>
            <div class="progress">
              <div class="progress-bar progress-nays bg-red"></div>
            </div>
          </div>
        </div>
        <div class="card-footer">
          <div class="row align-items-center">
            <div class="col footer-btns"></div>
            <div class="col-auto ml-auto">
              <div class="avatar-list avatar-list-stacked"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`);

    $('.proposals').prepend(this.$card);
    this.sync(true, true);
  }

  async hide() {
    this.keepSync = false;
    this.btnYesNoEvents(true);
    this.btnFinalizeEvents(true);
  }

  /**
   * Status for the card
   */
  private async syncBlocksProgress(state: StateInterface): Promise<number> {
    const ends = +this.start + state.settings.get('voteLength');
    const current = app.getCurrentBlock();
    const endsIn = current < ends ? ends - current : 0;

    const endsInStr = Utils.formatNumber(endsIn);

    const $progress = this.$card.find('.blocks-progress');
    if ($progress.css('width') !== '100%') {
      let percent = 100;
      if (current < ends) {
        percent = ((current - this.start) / (ends - this.start)) * 100;
      } else {
        $progress.addClass('bg-gray');
      }
      $progress
        .css('width', `${percent}%`)
        .parent()
        .attr('title', `Vote ends in ${endsInStr} blocks`)
        .attr('data-original-title', `Vote ends in ${endsIn} blocks`)
        .find('.sr-only')
        .text(`Vote ends in ${endsIn} blocks`);
    }

    return endsIn;
  }
  private async syncAvatarList() {
    let avatarList = '';
    if (this.voted.length) {
      const maxLength = this.voted.length > 5 ? 5 : this.voted.length;
      for (let i = 0, j = maxLength; i < j; i++) {
        const acc = new Author(null, this.voted[i], null);
        const arId = await acc.getDetails();
        const avatar = arId.avatar;
        avatarList += `<span class="avatar" style="background-image: url(${avatar})" title="${arId.address}" data-original-title="${arId.address}" data-toggle="tooltip" data-placement="top"></span>`;
      }

      if (this.voted.length > 5) {
        avatarList += `<span class="avatar">+${5 - this.voted.length}</span>`;
      }
    }

    this.$card.find('.avatar-list').html(avatarList);
  }
  private async syncYaysNays() {
    let yaysPercent = 0;
    let naysPercent = 0;
    const total = this.yays + this.nays;

    if (total > 0) {
      yaysPercent = (this.yays / total) * 100;
      naysPercent = (this.nays / total) * 100;
    }

    this.$card.find('.txt-yays').text(`${yaysPercent}%`);
    this.$card.find('.progress-yays').css('width', `${yaysPercent}%`);
    this.$card.find('.txt-nays').text(`${naysPercent}%`);
    this.$card.find('.progress-nays').css('width', `${naysPercent}%`);
  }
  private async syncFooterButtons(state: StateInterface, endsIn: number) {
    const me = await app.getAccount().getAddress();

    this.btnYesNoEvents(true);
    this.btnFinalizeEvents(true);

    let footerBtns = `
    <a class="btn-vote-no btn btn-danger" href="#">NO</a>
    <a class="btn-vote-yes btn btn-success ml-3" href="#">YES</a>`;
    if (!endsIn) {
      if (this.status === 'active') {
        footerBtns = `<a href="#" class="btn-finalize btn btn-dark">Finalize</a>`;
        this.btnFinalizeEvents();
      } else {
        footerBtns = await Utils.capitalize(this.status);
      }
    } else if (this.voted.length && this.voted.includes(me)) {
      footerBtns = `<a class="btn btn-light disabled" href="#">Already Voted</a>`;
    } else {
      this.btnYesNoEvents();
    }

    this.$card.find('.footer-btns').html(footerBtns);
  }

  private btnYesNoEvents(off = false) {
    if (off) {
      this.$card.off('click', '.btn-vote-yes, .btn-vote-no');
      return;
    }

    this.$card.on('click', '.btn-vote-yes', async (e: any) => {
      e.preventDefault();

      if (!(await app.getAccount().isLoggedIn())) {
        return await app.getAccount().showLoginError();
      }

      $(e.target).addClass('btn-loading disabled');
      this.$card.find('.btn-vote-no').addClass('disabled');

      try {
        const txid = await app.getCommunity().vote(this.voteId, 'yay');
        app
          .getStatusify()
          .add('Vote', txid)
          .then(() => {
            this.sync(false);
          });
        $(e.target).removeClass('btn-loading');
      } catch (err) {
        console.log(err.message);
        const toast = new Toast();
        toast.show('Vote error', err.message, 'error', 3000);
        $(e.target).removeClass('btn-loading disabled');
      }
    });

    this.$card.on('click', '.btn-vote-no', async (e: any) => {
      e.preventDefault();

      if (!(await app.getAccount().isLoggedIn())) {
        return await app.getAccount().showLoginError();
      }

      $(e.target).addClass('btn-loading disabled');
      this.$card.find('.btn-vote-yes').addClass('disabled');

      try {
        const txid = await app.getCommunity().vote(this.voteId, 'nay');
        app
          .getStatusify()
          .add('Vote', txid)
          .then(() => {
            this.sync(false);
          });
        $(e.target).removeClass('btn-loading');
      } catch (err) {
        console.log(err.message);
        const toast = new Toast();
        toast.show('Vote error', err.message, 'error', 3000);
        $(e.target).removeClass('btn-loading disabled');
      }
    });
  }
  private btnFinalizeEvents(off = false) {
    if (off) {
      this.$card.off('click', '.btn-finalize');
      return;
    }

    this.$card.on('click', '.btn-finalize', async (e: any) => {
      e.preventDefault();

      if (!(await app.getAccount().isLoggedIn())) {
        return await app.getAccount().showLoginError();
      }

      $(e.target).addClass('btn-loading disabled');
      try {
        const txid = await app.getCommunity().finalize(this.voteId);
        app
          .getStatusify()
          .add('Finalize vote', txid)
          .then(() => {
            this.sync(false);
          });
        $(e.target).removeClass('btn-loading');
      } catch (err) {
        console.log(err.message);
        const toast = new Toast();
        toast.show('Vote error', err.message, 'error', 3000);
        $(e.target).removeClass('btn-loading disabled');
      }
    });
  }
}
