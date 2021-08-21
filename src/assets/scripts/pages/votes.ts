import $ from '../libs/jquery';
import 'bootstrap/dist/js/bootstrap.bundle';
import Utils from '../utils/utils';
import Toast from '../utils/toast';
import app from '../app';
import arweave from '../libs/arweave';
import Vote from '../models/vote';
import { VoteType, VoteInterface } from 'community-js/lib/faces';
import Dropbox from '../utils/dropbox';
import Community from 'community-js';

export default class PageVotes {
  private votes: Vote[] = [];
  private firstCall = true;

  async open() {
    $('.link-votes').addClass('active');
    $('.page-votes').show();
    this.syncPageState();
    this.events();
  }

  async close() {
    for (let i = 0, j = this.votes.length; i < j; i++) {
      this.votes[i].hide();
    }
    this.votes = [];

    await this.removeEvents();
    $('.link-votes').removeClass('active');
    $('.page-votes').hide();
  }

  public async syncPageState() {
    const state = await app.getCommunity().getState();

    $('.contract-src').val(await app.getCommunity().getContractSourceId());

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
    $('.voteLength')
      .text(` ${Utils.formatNumber(voteLength)} blocks (${Utils.formatBlocks(voteLength)})`)
      .val(voteLength);
    $('.lockMinLength')
      .text(` ${Utils.formatNumber(lockMinLength)} blocks (${Utils.formatBlocks(lockMinLength)})`)
      .val(lockMinLength);
    $('.lockMaxLength')
      .text(` ${Utils.formatNumber(lockMaxLength)} blocks (${Utils.formatBlocks(lockMaxLength)})`)
      .val(lockMaxLength);

    let logo = state.settings.get('communityLogo');
    $('.community-logo').val(logo);

    $('.ticker').text(` ${state.ticker} `).val(state.ticker);

    $('.min-lock-length').text(Utils.formatNumber(lockMinLength));
    $('.max-lock-length').text(Utils.formatNumber(lockMaxLength));

    if (this.firstCall) {
      this.extraParams();
      this.firstCall = false;
    }

    $('.proposals').html('');
    if (state.votes.length) {
      this.votes = [];
      $('.proposals').html('');
      for (let i = 0, j = state.votes.length; i < j; i++) {
        const vote = new Vote(state.votes[i], i);
        this.votes.push(vote);
        await vote.show();
      }
    } else {
      const html = `
      <div class="col-12">
        <div class="card">
          <div class="card-body text-center">
            This Community doesn't have any votes.
          </div>
        </div>
      </div>
      `;
      $('.proposals').html(html);
    }

    // @ts-ignore
    $('[data-toggle="tooltip"]').tooltip();
    $('.dimmer').removeClass('active');
  }

  private async extraParams() {
    // Check for hashes to see if we need to open the votes modal.
    const hashes = app.getHashes();
    if (hashes.length > 2 && hashes[2] === 'mint') {
      const addy = hashes[3];
      const qty = hashes[4];
      const lockLength = hashes[5];

      if (addy) {
        $('#vote-recipient').val(addy.trim());
      }
      if (qty) {
        $('#vote-qty').val(qty.trim());
      }
      if (lockLength) {
        $('#vote-lock-length').val(lockLength.trim());
      }

      // @ts-ignore
      $('#modal-new-vote').modal('show');
    }
  }

  private showLogo(hash) {
    $('#vote-set-value').removeClass('is-invalid');
  }

  private setLogoInvalid() {
    $('#vote-set-value').addClass('is-invalid');
  }

  private async setValueValidate() {
    const state = await app.getCommunity().getState();

    const recipient = $('#vote-recipient').val().toString().trim();
    const setKey = $('#vote-set-key').val();
    let setValue: string | number = $('#vote-set-value').val().toString().trim();

    if ($('.url:visible').length) {
      let urlsValid = true;
      $('.url:visible').each(function () {
        try {
          const url: string = $(this).val().toString().trim();
          new URL(url);
          $(this).removeClass('is-invalid');
        } catch (_) {
          $(this).addClass('is-invalid');
          urlsValid = false;
        }
      });
      return urlsValid;
    }

    if (setKey === 'quorum' || setKey === 'support') {
      setValue = +setValue;
      if (isNaN(setValue) || setValue < 1 || setValue > 99 || !Number.isInteger(setValue)) {
        $('#vote-set-value').addClass('is-invalid');
        return false;
      } else {
        $('#vote-set-value').removeClass('is-invalid');
      }
    } else if (setKey === 'lockMinLength' || setKey === 'lockMaxLength') {
      setValue = +setValue;
      if (isNaN(setValue) || setValue < 1 || !Number.isInteger(setValue)) {
        if (setKey === 'lockMinLength') {
          $('.lock-set-value-invalid').text(
            'Minimum lock length cannot be greater nor equal to the maximum lock length.',
          );
          $('#vote-set-value').addClass('is-invalid');
        } else if (setKey === 'lockMaxLength') {
          $('.lock-set-value-invalid').text(
            'Maximum lock length cannot be lower nor equal to the minimum lock length.',
          );
          $('#vote-set-value').addClass('is-invalid');
        }
        return false;
      }

      if (setKey === 'lockMinLength' && setValue > state.settings.get('lockMaxLength')) {
        $('.lock-set-value-invalid').text(
          'Minimum lock length cannot be greater nor equal to the maximum lock length.',
        );
        $('#vote-set-value').addClass('is-invalid');
        return false;
      } else if (setKey === 'lockMaxLength' && setValue < state.settings.get('lockMinLength')) {
        $('.lock-set-value-invalid').text('Maximum lock length cannot be lower nor equal to the minimum lock length.');
        $('#vote-set-value').addClass('is-invalid');
        return false;
      }
    } else if (setKey === 'role') {
      if (!Utils.isArTx(recipient)) {
        $('#vote-recipient').addClass('is-invalid');
        return false;
      }
      if (!setValue.length) {
        $('.lock-set-value-invalid').text('Need to type a role.');
        $('#vote-set-value').addClass('is-invalid');
        return false;
      }
    } else if (setKey === 'communityLogo') {
      this.setLogoInvalid(); // not yet validated
      const setValue: string = $('#vote-set-value').val().toString().trim();
      if (setValue === '') {
        // TODO: more wide condition
        this.setLogoInvalid(); // don't query the network in this case
      } else {
        arweave.transactions.getStatus(setValue).then((status) => {
          if (status.status === 200) {
            this.showLogo(setValue);
          } else {
            this.setLogoInvalid();
          }
        });
      }
    } else if (setKey === 'evolve') {
      let canEvolve = state.settings?.get('canEvolve');
      if (canEvolve === false) {
        $('.lock-set-value-invalid').text('Evolve is currently locked');
        $('#vote-set-value').addClass('is-invalid');
        return false;
      }

      if (!setValue.length || !/[a-z0-9_-]{43}/i.test(setValue)) {
        $('.lock-set-value-invalid').text('Invalid contract source txid');
        $('#vote-set-value').addClass('is-invalid');
        return false;
      }
    } else {
      $('.lock-set-value-invalid').text('');
    }

    if ($('#vote-set-key').val() !== 'communityLogo') {
      // communityLogo is validated "dynamically", see above.
      $('#vote-set-value').removeClass('is-invalid');
    }
    return true;
  }

  private async setNameValidate() {
    if ($('#vote-set-key').val() !== 'other') {
      return true; // no need to validate the key
    }
    if ($('#vote-set-name').val() === '') {
      $('#vote-set-name').addClass('is-invalid');
      return false;
    } else {
      $('#vote-set-name').removeClass('is-invalid');
    }
    return true;
  }

  private async setValidate() {
    let valid = true;
    if (!(await this.setValueValidate())) {
      valid = false;
    }
    if (!(await this.setNameValidate())) {
      valid = false;
    }
    return valid;
  }

  private async handleLogo() {
    const dropbox = new Dropbox($('.logo-box'));
    dropbox.showAndDeploy(await app.getAccount().getWallet()).then((logoId) => {
      if (logoId) {
        $('#vote-set-value, #vote-comm-logo').val(logoId);
        this.showLogo(logoId);
      }
      this.handleLogo();
    });
  }
  private modifyVotes() {
    // Disallow spaces
    $('#vote-set-name').on('input', (e) => {
      const setName: string = $('#vote-set-name').val().toString().replace(' ', '-');
      $('#vote-set-name').val(setName);
    });
  }

  private removeModifyVotes() {
    $('#vote-set-name').off('input');
    $('#vote-logo').off('change');
  }

  async validateVotes() {
    $('input[name="voteType"]')
      .on('change', (e) => {
        const voteType = $('input[name="voteType"]:checked').val();

        switch (voteType) {
          case 'mint':
            $('.vote-recipient, .vote-qty, .vote-lock-length').show();
            $('.vote-fields').hide();
            break;
          case 'burnVault':
            $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields, .vote-evolve').hide();
            $('.vote-burn-vault').show();
            break;
          case 'set':
            $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields, .vote-evolve').hide();
            $('.vote-set').show();
            $('#vote-set-key').trigger('change');
            break;
          case 'indicative':
            $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields, .vote-evolve').hide();
            break;
          case 'evolve':
            $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields, .vote-evolve').hide();
            this.handleLogo();
            $('.vote-evolve').show();
            break;
        }
      })
      .trigger('change');

    function updateOtherIsNumber() {
      if ($('#vote-set-value-is-number').is(':checked')) {
        $('#vote-set-value').addClass('input-float');
        $('#vote-set-value').trigger('input');
      } else {
        $('#vote-set-value').removeClass('input-float');
      }
    }

    $('#vote-set-key').on('change', async (e) => {
      const setKey = $(e.target).val();
      const $target = $('#vote-set-value').val('');

      $('.vote-recipient').hide();
      $('.vote-set-name').hide();
      $('#vote-set-value-is-number-label').hide();
      if (setKey !== 'communityDescription') {
        $('#vote-set-value2').hide();
      }
      if (setKey !== 'communityAppUrl') {
        $('#vote-set-value2').removeClass('url');
      }
      if (setKey !== 'communityDiscussionLinks') {
        $('#vote-set-value').show();
        $('#vote-set-value-links-container').hide();
      }
      if (setKey !== 'communityLogo') {
        // $('#vote-set-value-logo-preview').hide();
        $('#vote-logo').hide();
      }
      $('#vote-set-value').removeClass('input-number input-float percent url');

      switch (setKey) {
        case 'role':
          $('.vote-recipient').show();
          break;
        case 'lockMinLength':
        case 'lockMaxLength':
          $target.addClass('input-number');
          break;
        case 'quorum':
        case 'support':
          $target.addClass('input-number percent');
          break;
        case 'communityDescription':
          $('#vote-set-value, #vote-set-value3').hide();
          $('#vote-set-value2').show();
          break;
        case 'communityHide':
          $('#vote-set-value, #vote-set-value2').hide();
          $('#vote-set-value3').show();
        case 'communityAppUrl':
          $target.addClass('url');
          break;
        case 'communityLogo':
          $('#vote-logo').show();
          this.handleLogo();
          $target.trigger('input');
          break;
        case 'communityDiscussionLinks':
          $('#vote-set-value, #vote-set-value3').hide();
          $('#vote-set-value-links-container').show();
          break;
        case 'other':
          updateOtherIsNumber();
          $('.vote-set-name').show();
          $('#vote-set-value-is-number-label').show();
          break;
      }

      await this.setValidate();
    });

    $('#vote-set-value-is-number').on('click', (e) => {
      updateOtherIsNumber();
    });

    function updateUpDownArrows() {
      // Now we have only one table with arrows, so it's efficient enough. If we add more tables, probably should restrict to one table at a time.
      $('.move-up-tr').each(function () {
        $(this).css('visibility', $(this).closest('tr').is(':nth-child(2)') ? 'hidden' : 'visible');
      });
      $('.move-down-tr').each(function () {
        $(this).css('visibility', $(this).closest('tr').is(':last-child') ? 'hidden' : 'visible');
      });
    }

    $('.delete-tr').on('click', (e) => {
      $(e.target).closest('tr').remove();
      updateUpDownArrows();
    });

    $('.move-up-tr').on('click', (e) => {
      const row = $(e.target).closest('tr');
      row.prev().before(row);
      updateUpDownArrows();
    });

    $('.move-down-tr').on('click', (e) => {
      const row = $(e.target).closest('tr');
      row.next().after(row);
      updateUpDownArrows();
    });

    $('#vote-set-value-links-add').on('click', (e) => {
      const copy = $('#vote-set-value-links-template').clone(true);
      copy.css('display', 'block');
      $('#vote-set-value-links-template').parent().append(copy);
      updateUpDownArrows();
    });

    $('#vote-recipient, #vote-target').on('input', async (e) => {
      const $target = $(e.target);
      const value = $target.val().toString().trim();
      if (!(await Utils.isArTx(value))) {
        $target.addClass('is-invalid');
      } else {
        $target.removeClass('is-invalid');
      }
    });

    $('.btn-max-lock').on('click', async (e) => {
      e.preventDefault();

      const state = await app.getCommunity().getState();
      $('.input-max-lock').val(state.settings.get('lockMaxLength'));
    });

    $('#vote-set-value').on('input', async (e) => {
      await this.setValueValidate();
    });

    $('.value-url').on('input', async (e) => {
      await this.setValueValidate();
    });

    $('#vote-set-name').on('input', async (e) => {
      await this.setNameValidate();
    });

    $('#vote-qty').on('input', async (e) => {
      const qty = +$('#vote-qty').val().toString().trim();

      if (qty < 1 || !Number.isInteger(qty)) {
        $('#vote-qty').addClass('is-invalid');
      } else {
        $('#vote-qty').removeClass('is-invalid');
      }
    });

    $('#vote-lock-length').on('input', async (e) => {
      const length = +$('#vote-lock-length').val().toString().trim();
      const state = await app.getCommunity().getState();

      if (
        isNaN(length) ||
        !Number.isInteger(length) ||
        ((length < state.settings.get('lockMinLength') || length > state.settings.get('lockMaxLength')) && length != 0)
      ) {
        $('#vote-lock-length').addClass('is-invalid');
      } else {
        $('#vote-lock-length').removeClass('is-invalid');
      }
    });

    $('#vote-target').on('input', async (e) => {
      const target = $('#vote-target').val().toString().trim();
      if (!(await Utils.isArTx(target))) {
        $('#vote-target').addClass('is-invalid');
      } else {
        $('#vote-target').removeClass('is-invalid');
      }
    });

    $('#vote-note').on('input', (e) => {
      const note = $('#vote-note').val().toString().trim();
      if (!note.length) {
        $('#vote-note').addClass('is-invalid');
      } else {
        $('#vote-note').removeClass('is-invalid');
      }
    });

    $('.do-vote').on('click', async (e) => {
      e.preventDefault();
      const state = await app.getCommunity().getState();

      // @ts-ignore
      const voteType: VoteType = $('input[name="voteType"]:checked').val().toString();
      const recipient = $('#vote-recipient').val().toString().trim();
      const qty = +$('#vote-qty').val().toString().trim();
      const length = +$('#vote-lock-length').val().toString().trim();
      const target = $('#vote-target').val().toString().trim();
      const setKey = $('#vote-set-key').val();
      let setValue: string | number | string[];
      if (setKey === 'communityDiscussionLinks') {
        const rows = $('#vote-set-value-links-template').nextAll();
        setValue = rows
          .find('input[type=text]')
          .map(function () {
            return $(this).val().toString();
          })
          .get();
      } else if ($('#vote-set-value2').css('display') !== 'none') {
        setValue = $('#vote-set-value2').val().toString().trim();
      } else if ($('#vote-set-value3').css('display') !== 'none') {
        setValue = $('#vote-set-value3').val().toString().trim();
      } else {
        setValue = $('#vote-set-value').val().toString().trim();
      }
      if (setKey === 'other' && $('#vote-set-value-is-number').is(':checked')) {
        setValue = Number(setValue);
      }
      const note = $('#vote-note').val().toString().trim();

      const voteParams: VoteInterface = {
        type: voteType,
      };

      if (voteType === 'mint') {
        if (!(await Utils.isArTx(recipient))) {
          $('#vote-recipient').addClass('is-invalid');
          return;
        }
        if (qty < 1 || !Number.isInteger(qty)) {
          $('#vote-qty').addClass('is-invalid');
          return;
        }

        voteParams['recipient'] = recipient;
        voteParams['qty'] = qty;

        // If a lock length was specified, mint locked tokens.
        if (length > 0) {
          if (
            isNaN(length) ||
            !Number.isInteger(length) ||
            length < state.settings.get('lockMinLength') ||
            length > state.settings.get('lockMaxLength')
          ) {
            $('#vote-lock-length').addClass('is-invalid');
            return;
          }
          voteParams['type'] = 'mintLocked';
          voteParams['lockLength'] = length;
        }
      } else if (voteType === 'burnVault') {
        if (!(await Utils.isArTx(target))) {
          $('#vote-target').addClass('is-invalid');
          return;
        }
        voteParams['target'] = target;
      } else if (voteType === 'set') {
        if (!(await this.setValidate())) {
          return;
        }

        // @ts-ignore
        voteParams['key'] = setKey === 'other' ? $('#vote-set-name').val().toString() : setKey;
        voteParams['value'] = setValue;
      }

      // } else if (voteType === 'evolve') {
      //   try {
      //     $(e.target).addClass('btn-loading disabled');
      //     voteParams.type = 'set';
      //     const newCommId = await this.evolve();
      //     voteParams['key'] = 'evolve';
      //     voteParams['value'] = newCommId;
      //   } catch (err) {
      //     console.log(err);
      //     const toast = new Toast();
      //     toast.show('Evolve error', err.message, 'error', 3000);
      //     $(e.target).removeClass('btn-loading disabled');
      //     return;
      //   }
      // }

      if (!note.length) {
        $('#vote-note').addClass('is-invalid');
        return;
      }
      voteParams['note'] = note;

      // All validations passed
      $(e.target).addClass('btn-loading disabled');
      try {
        const txid = await app.getCommunity().proposeVote(voteParams);
        app
          .getStatusify()
          .add('Create vote', txid)
          .then(async () => {
            // Just create the new vote, do not sync the entire page.
            const state = await app.getCommunity().getState(false);

            if (this.votes.length < state.votes.length) {
              const vote = new Vote(state.votes[this.votes.length], this.votes.length);
              this.votes.push(vote);
              await vote.show();
            }
          });
      } catch (err) {
        console.log(err.message);
        const toast = new Toast();
        toast.show('Vote error', err.message, 'error', 3000);
      }

      // @ts-ignore
      $('#modal-new-vote').modal('hide');
      $(e.target).removeClass('btn-loading disabled');
    });
  }

  async updateDefaults() {
    const state = await app.getCommunity().getState();
    if (state.votes[state.votes.length - 1].status === 'active') {
      throw new Error('You cannot evolve when there are active votes');
    }

    const community = new Community(arweave);

    await community.setWallet(await app.getAccount().getWallet());

    if (!(await community.setContractSourceId($('#vote-contract-src').val().toString().trim()))) {
      throw new Error('Invalid contract source ID.');
    }

    // Set all the params
    state.settings.set('communityLogo', $('#vote-comm-logo').val().toString().trim());

    const create = {
      communityName: $('#vote-comm-name').val().toString().trim(),
      ticker: $('#vote-comm-ticker').val().toString().trim(),
      balances: state.balances,
      quorum: +$('#quorum').val().toString().trim(),
      support: +$('#support').val().toString().trim(),
      voteLength: +$('#voteLength').val().toString().trim(),
      lockMinLength: +$('#lockMinLength').val().toString().trim(),
      lockMaxLength: +$('#lockMaxLength').val().toString().trim(),
      vault: state.vault,
      votes: state.votes,
      roles: state.roles,
      extras: [],
    };

    console.log(create);

    for (const key of Object.keys(create)) {
      if (!create[key]) {
        throw new Error(`${key} is required`);
      }
    }

    for (const key of ['quorum', 'support', 'voteLength', 'lockMinLength', 'lockMaxLength']) {
      if (isNaN(create[key]) || create[key] < 1) {
        throw new Error(`${key} must be greater than 0`);
      }
      state.settings.delete(key);
    }
    create.extras = Array.from(state.settings);

    // Validate params
    if (create.communityName.length < 3) {
      throw new Error('Community name must be at least 3 characters');
    } else if (create.ticker.length < 3) {
      throw new Error('Ticker must be at least 3 characters');
    } else if (create.quorum > 99) {
      throw new Error('Quorum cannot be greater than 99');
    } else if (create.support > 99) {
      throw new Error('Support cannot be greater than 99');
    } else if (create.lockMinLength >= create.lockMaxLength) {
      throw new Error('Lock min length cannot be greater than lock max length');
    } else if (create.lockMaxLength <= create.lockMinLength) {
      throw new Error('Lock max length cannot be lower than lock min length');
    }

    // Create the new community
    const newState = await community.setState(
      create.communityName,
      create.ticker,
      create.balances,
      create.quorum,
      create.support,
      create.voteLength,
      create.lockMinLength,
      create.lockMaxLength,
      create.vault,
      create.votes,
      create.roles,
      create.extras,
    );

    console.log(newState, newState.settings);

    return await community.create();
  }

  async removeValidateVotes() {
    $('input[name="voteType"], #vote-set-key').off('change');
    $('#vote-recipient, #vote-target, #vote-set-value').off('input');
    $('.btn-max-lock, .do-vote').off('click');
  }

  private async events() {
    await this.modifyVotes();
    await this.validateVotes();
  }
  private async removeEvents() {
    await this.removeValidateVotes();
    await this.removeModifyVotes();
  }
}
