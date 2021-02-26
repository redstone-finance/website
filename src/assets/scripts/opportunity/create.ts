import Quill from 'quill';
import jobboard from './jobboard';
import Utils from '../utils/utils';
import { OpportunityCommunityInterface } from '../interfaces/opportunity';
import Transaction from 'arweave/node/lib/transaction';
import { StateInterface } from 'community-js/lib/faces';
import Community from 'community-js';
import Toast from '../utils/toast';
import arweave from '../libs/arweave';

export default class PageCreateJob {
  private quill: Quill;
  private tx: Transaction;

  private community: OpportunityCommunityInterface = {
    id: '',
    name: '',
    ticker: '',
  };
  private transferFee = 0;

  async open() {
    if (!this.quill) {
      const toolbarOptions = [
        [{ header: [false, 2, 3, 4, 5, 6] }],
        ['bold', 'italic', 'underline', 'strike'], // toggled buttons
        ['blockquote', 'code-block', 'image', 'link'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
        ['clean'], // remove formatting button
      ];

      this.quill = new Quill('#quill-editor', {
        modules: {
          toolbar: toolbarOptions,
        },
        theme: 'snow',
      });

      $('.ql-editor').css('min-height', 150);
    }

    $('.jobboard-create').show();
    this.events();
  }

  async close() {
    await this.removeEvents();
    $('.jobboard-create').hide();
  }

  async syncPageState() {
    if (!(await jobboard.getAccount().isLoggedIn())) {
      window.location.hash = '';
    }
  }

  private async updateCommunity($target: any, val: string) {
    $target.removeClass('is-invalid');
    $target.prop('disabled', true).siblings('.input-icon-addon').show();
    this.community.id = val;

    let state: StateInterface;
    try {
      await jobboard.setCommunityTx(val);
      state = await jobboard.getCommunity().getState();

      this.community.name = state.name;
      this.community.ticker = state.ticker;
    } catch (err) {
      // @ts-ignore
      this.community = {};
      $('.community-name').text('');
      $('.ticker').text('');

      $target.addClass('is-invalid');
    }

    $target.prop('disabled', false).siblings('.input-icon-addon').hide();

    if (!state || !this.community.name) {
      return;
    }

    $('.community-name').text(state.name);
    $('.ticker').text(state.ticker);
  }

  private async submit() {
    const title = $.trim(Utils.stripHTML($('#job-title').val().toString()));
    const amount = +$.trim(Utils.stripHTML($('#job-amount').val().toString()));
    const lockLength = +$.trim(Utils.stripHTML($('#job-lock-length').val().toString()));
    const description = $.trim(Utils.escapeScriptStyles(this.quill.root.innerHTML));
    const jobType = $.trim(Utils.stripHTML($('[name="job-type"]:checked').val().toString()));
    const expLevel = $.trim(Utils.stripHTML($('[name="job-exp"]:checked').val().toString()));
    const commitment = $.trim(Utils.stripHTML($('[name="job-commitment"]:checked').val().toString()));
    const project = $.trim(Utils.stripHTML($('[name="job-project"]:checked').val().toString()));
    const permission = $.trim(Utils.stripHTML($('[name="permission"]:checked').val().toString()));

    const toast = new Toast();

    if (title.length < 3) {
      toast.show('Error', "The title doesn't explain what is this opportunity.", 'error', 5000);
      return;
    }

    if (!this.community.id || !(await Utils.isArTx(this.community.id)) || !this.community.name.length) {
      toast.show('Error', 'There seems to be an issue with your community ID. Please type it again.', 'error', 5000);
      return;
    }

    if (!$(this.quill.root).text().trim().length) {
      toast.show('Error', 'Description is required.', 'error', 5000);
      return;
    }

    if (isNaN(amount) || amount < 1) {
      toast.show('Error', 'Invalid payout amount.', 'error', 5000);
      return;
    }

    if (isNaN(lockLength) || lockLength < 0) {
      toast.show('Error', 'Invalid lock length.', 'error', 5000);
      return;
    }

    // Create the transaction
    this.tx = await arweave.createTransaction({ data: description }, await jobboard.getAccount().getWallet());
    this.tx.addTag('Content-Type', 'text/html');
    this.tx.addTag('App-Name', 'CommunityXYZ');
    this.tx.addTag('Action', 'addOpportunity');
    this.tx.addTag('title', title);
    this.tx.addTag('jobType', jobType);
    this.tx.addTag('expLevel', expLevel);
    this.tx.addTag('commitment', commitment);
    this.tx.addTag('project', project);
    this.tx.addTag('permission', permission);
    this.tx.addTag('payout', amount.toString());
    this.tx.addTag('lockLength', lockLength.toString());

    this.tx.addTag('communityId', this.community.id);
    this.tx.addTag('communityName', this.community.name);
    this.tx.addTag('communityTicker', this.community.ticker);

    this.tx.addTag('Service', 'Community.XYZ');
    this.tx.addTag('Community-ID', this.community.id);
    this.tx.addTag('Message', `Added opportunity ${title} of ${Utils.formatNumber(amount)} ${this.community.ticker}`);
    this.tx.addTag('Type', 'ArweaveActivity');

    const cost = arweave.ar.winstonToAr(this.tx.reward, { formatted: true, decimals: 5, trim: true });

    this.transferFee = Math.round((amount * 2.5) / 100);

    $('.fee').text(+cost + +jobboard.getFee());
    $('.comm-fee').text(`${this.transferFee} ${this.community.ticker}`);

    // @ts-ignore
    $('#confirm-modal').modal('show');
  }

  private async events() {
    $('#job-community').on('input', async (e: any) => {
      const val = $(e.target).val().toString().trim();
      if (!(await Utils.isArTx(val))) {
        // @ts-ignore
        this.community = {};
        $('.community-name').text('');
        $('.ticker').text('');

        $(e.target).addClass('is-invalid');
        return;
      }

      this.updateCommunity($(e.target), val);
    });

    $('.submit-job').on('click', async (e: any) => {
      e.preventDefault();

      await this.submit();
    });
    $('.confirm-tx').on('click', async (e: any) => {
      e.preventDefault();

      $(e.target).addClass('btn-loading');

      const community = jobboard.getCommunity();
      const account = jobboard.getAccount();
      const addy = await account.getAddress();

      await arweave.transactions.sign(this.tx, await account.getWallet());
      const txid = this.tx.id;

      const state = await community.getState();
      const toast = new Toast();

      if (!state.balances || !state.balances[addy] || state.balances[addy] < this.transferFee) {
        $(e.target).removeClass('btn-loading');
        toast.show('Error', "You don't have enough Community balance for this transaction.", 'error', 5000);
        return;
      }

      if ((await account.getArBalance()) < +$('.fee').text()) {
        $(e.target).removeClass('btn-loading');
        toast.show('Error', "You don't have enough balance for this transaction.", 'error', 5000);
        return;
      }

      const fees = await jobboard.getChargeFee();

      if (!fees) {
        $(e.target).removeClass('btn-loading');
        toast.show('Error', 'Error while trying to charge the fee for this transaction.', 'error', 5000);
        return;
      }

      let mainComm = new Community(arweave);
      const mainCommTx = await mainComm.getMainContractId();
      await mainComm.setCommunityTx(mainCommTx);

      const target = await mainComm.selectWeightedHolder();
      mainComm = null;

      if (target !== addy) {
        await community.setCommunityTx(this.community.id);
        await community.setWallet(await jobboard.getAccount().getWallet());
        await community.transfer(target, this.transferFee);
      }

      // @ts-ignore
      $('#confirm-modal').modal('hide');

      const res = await arweave.transactions.post(this.tx);
      if (res.status !== 200 && res.status !== 202) {
        $(e.target).removeClass('btn-loading');
        return toast.show('Error', 'Error while submiting the transaction.', 'error', 5000);
      }

      this.community = { id: '', name: '', ticker: '' };
      $(e.target).removeClass('btn-loading');
      $('#job-title').val('');
      $('#job-amount').val('');
      $('#job-lock-length').val('');
      $('[name="job-type"]').first().click();
      $('[name="job-exp"]').first().click();
      $('[name="job-commitment"]').first().click();
      $('[name="job-project"]').first().click();
      $('[name="permission"]').first().click();
      this.quill.root.innerHTML = '';
      window.location.hash = txid;

      jobboard.getStatusify().add('Add opportunity', txid);
    });
  }

  private async removeEvents() {
    $('.submit-job, .confirm-tx').off('click');
  }
}
