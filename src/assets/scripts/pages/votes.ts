import $ from '../libs/jquery';
import Utils from '../utils/utils';
import Toast from '../utils/toast';
import app from '../app';
import arweave from '../libs/arweave';
import Vote from '../models/vote';
import { VoteType, VoteInterface } from 'community-js/lib/faces';
import Dropbox from '../utils/dropbox';

export default class PageVotes {
  private votes: Vote[] = [];
  private firstCall: boolean = true;

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

    $('.min-lock-length').text(state.settings.get('lockMinLength'));
    $('.max-lock-length').text(state.settings.get('lockMaxLength'));

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
    // $('#vote-set-value-logo-preview').attr('src', "https://arweave.net/" + hash);
    // $('#vote-set-value-logo-preview').show();
  }

  private setLogoInvalid() {
    $('#vote-set-value').addClass('is-invalid');
    // $('#vote-set-value-logo-preview').hide();
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
      let setValue: string = $('#vote-set-value').val().toString().trim();
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
    const dropbox = new Dropbox($('#logo-box'));
    console.log(await app.getAccount().getWallet());
    dropbox.showAndDeploy(await app.getAccount().getWallet()).then((logoId) => {
      if (logoId) {
        $('#vote-set-value').val(logoId);
        this.showLogo(logoId);
      }
      this.handleLogo();
    });
  }
  private modifyVotes() {
    // Disallow spaces
    $('#vote-set-name').on('input', (e) => {
      let setName: string = $('#vote-set-name').val().toString().replace(' ', '-');
      $('#vote-set-name').val(setName);
    });
  }

  private removeModifyVotes() {
    $('#vote-set-name').off('input');
    $('#logo-box').off('change');
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
            $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields').hide();
            $('.vote-burn-vault').show();
            break;
          case 'set':
            $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields').hide();
            $('.vote-set').show();
            $('#vote-set-key').trigger('change');
            break;
          case 'indicative':
            $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields').hide();
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
        $('#logo-box').hide();
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
          $('#vote-set-value').hide();
          $('#vote-set-value2').show();
          break;
        case 'communityAppUrl':
          $target.addClass('url');
          break;
        case 'communityLogo':
          $('#logo-box').show();
          this.handleLogo();
          $target.trigger('input');
          break;
        case 'communityDiscussionLinks':
          $('#vote-set-value').hide();
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
      } else {
        setValue = $('#vote-set-value').val().toString().trim();
      }
      if (setKey === 'other' && $('#vote-set-value-is-number').is(':checked')) {
        setValue = Number(setValue);
      }
      const note = $('#vote-note').val().toString().trim();

      let voteParams: VoteInterface = {
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

            const voteId = state.votes.length - 1;
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
