import Community from 'community-js';
import $ from './libs/jquery';
import 'bootstrap/dist/js/bootstrap.bundle';

import './global';
import arweave from './libs/arweave';
import Dropbox from './utils/dropbox';
import Account from './models/account';
import Utils from './utils/utils';

const community = new Community(arweave);
const account = new Account(community);

let currentStep = 1;
const create = {
  communityName: '',
  communityLogo: '',
  communityDescription: '',
  communityAppUrl: '',
  ticker: '',
  balances: {},
  support: 0,
  quorum: 0,
  voteLength: 0,
  lockMinLength: 0,
  lockMaxLength: 0,
};

const createCommunity = () => {
  community
    .create()
    .then((communityTx) => {
      $('.mining-btn').attr('href', `./#${communityTx}`);

      const attempt = async () => {
        const res = await arweave.transactions.getStatus(communityTx);
        if (res.status !== 200 && res.status !== 202) {
          $('.mining-btn')
            .removeClass('btn-primary')
            .addClass('btn-danger')
            .addClass('disabled')
            .text('Transaction Rejected');
        }

        if (res.confirmed) {
          // TODO: Show confirmed transaction
          $('.mining-btn').text(`DONE! VISIT YOUR COMMUNITY`).removeClass('disabled');
          return;
        }

        setTimeout(() => attempt(), 30000);
      };
      attempt();
    })
    .catch((e) => {
      console.log(e);
    });
};

const allowContinue = () => {
  $('.continue').text(currentStep === 4 ? 'Launch Community' : 'Continue');
  $('.continue').prop('disabled', false);
};

const validate = async (e: any) => {
  console.log(e, currentStep);

  if (currentStep === 1) {
    if (!e) {
      $('.addy').text(await account.getAddress());
      $('.bal').text(Utils.formatNumber(await account.getArBalance(), 5));

      allowContinue();
    } else if (e.target && e.target.files) {
      $('.form-file-text').text(
        $(e.target)
          .val()
          .toString()
          .replace(/C:\\fakepath\\/i, ''),
      );
      $('.form-file-button').addClass('btn-loading disabled');

      allowContinue();
    }
  } else if (currentStep === 2) {
    create.communityName = $('#communityname').val().toString().trim();
    create.communityLogo = $('#communitylogo').val().toString().trim();
    create.communityDescription = $('#communitydesc').val().toString().trim();
    create.communityAppUrl = $('#communityappurl').val().toString().trim();
    create.ticker = $('#psttoken').val().toString().trim().toUpperCase();

    $('.communityname').text(create.communityName);
    $('.communitydesc').text(create.communityDescription);
    $('.communityappurl').text(create.communityAppUrl);

    const config = arweave.api.getConfig();
    const logo = `${config.protocol}://${config.host}:${config.port}/${create.communityLogo}`;

    $('.communitylogo').attr('src', logo);
    $('.ticker').text(create.ticker);

    const $holders = $('.holder');
    const $holdersBalance = $('.holder-balance');

    create.balances = {};
    for (let i = 0, j = $holders.length; i < j; i++) {
      const $holder = $($holders[i]);
      const holder = $holder.val().toString().trim();
      const bal = +$($holdersBalance[i]).val().toString().trim();

      if (!/^[a-z0-9-_]{43}$/i.test(holder)) {
        $holder.addClass('border-danger');
        continue;
      } else {
        $holder.removeClass('border-danger');
      }

      if (holder.length && bal && !isNaN(bal) && Number.isInteger(bal)) {
        create.balances[holder] = bal;
      }
    }

    if (create.communityName.length && create.ticker.length && Object.keys(create.balances).length) {
      // add each holders and their balances
      let html = '';
      let i = 0;
      for (const acc in create.balances) {
        html += `<tr>
          <td data-label="Wallet #${++i}">${acc}</td>
          <td data-label="Balance">${create.balances[acc]}</td>
        </tr>`;
      }
      $('.show-holders').find('tbody').html(html);

      allowContinue();
    }
  } else if (currentStep === 3) {
    const support = +$('#support').val().toString().trim();
    const quorum = +$('#quorum').val().toString().trim();
    const voteLength = +$('#voteLength').val().toString().trim();
    const lockMinLength = +$('#lockMinLength').val().toString().trim();
    const lockMaxLength = +$('#lockMaxLength').val().toString().trim();

    if (!isNaN(support) && Number.isInteger(support) && support < 100) {
      create.support = support;
    }
    if (!isNaN(quorum) && Number.isInteger(quorum) && quorum < 100) {
      create.quorum = quorum;
    }
    if (!isNaN(voteLength) && Number.isInteger(voteLength)) {
      create.voteLength = voteLength;
    }
    if (!isNaN(lockMinLength) && Number.isInteger(lockMinLength)) {
      create.lockMinLength = lockMinLength;
    }
    if (!isNaN(lockMaxLength) && Number.isInteger(lockMaxLength)) {
      create.lockMaxLength = lockMaxLength;
    }

    if (create.support && create.quorum && create.voteLength && create.lockMinLength && create.lockMaxLength) {
      $('.support').text(create.support);
      $('.quorum').text(create.quorum);
      $('.voteLength').text(create.voteLength);
      $('.lockMinLength').text(create.lockMinLength);
      $('.lockMaxLength').text(create.lockMaxLength);

      allowContinue();
    }
  } else if (currentStep === 4) {
    await community.setState(
      create.communityName,
      create.ticker,
      create.balances,
      create.quorum,
      create.support,
      create.voteLength,
      create.lockMinLength,
      create.lockMaxLength,
      {},
      [],
      {},
      [
        ['communityLogo', create.communityLogo],
        ['communityDescription', create.communityDescription],
        ['communityAppUrl', create.communityAppUrl],
      ],
    );
    const cost = await community.getCreateCost();
    const ar = +arweave.ar.winstonToAr(cost, { formatted: true, decimals: 5, trim: true });
    $('.cost').text(ar);
    if ((await account.getArBalance()) < ar) {
      $('.continue').removeClass('btn-primary').addClass('btn-danger').text('Not enough balance');
      return;
    }

    const checked = $('#confirm').prop('checked') && $('#aknowledge').prop('checked');
    if (checked) {
      $('#confirm, #aknowledge').prop('disabled', true);
      allowContinue();
    }
  }
};

// @ts-ignore
window.currentPage = {
  syncPageState: () => {
    console.log('currentPage');
    validate(null);
  },
};

const handleLogo = async () => {
  const dropbox = new Dropbox($('.logo-box'));
  dropbox.showAndDeploy(await account.getWallet()).then((logoId) => {
    if (logoId) {
      $('#communitylogo').val(logoId);
    }

    handleLogo();
  });
};

$(async () => {
  await account.init();
  handleLogo();

  // @ts-ignore
  $('[data-toggle="popover"]').popover();

  $('.back').on('click', (e: any) => {
    e.preventDefault();
    $(e.target).trigger('blur');

    if (!$(e.target).is('disabled') && currentStep > 1) {
      $(`.step${currentStep}`).fadeOut(() => {
        $(`.step${--currentStep}`).fadeIn();

        if (currentStep === 1) {
          $(e.target).addClass('disabled');
        } else {
          $(e.target).removeClass('disabled');
        }

        $('.continue').text(currentStep === 4 ? 'Launch Community' : 'Continue');
        $('.continue').removeClass('btn-danger').addClass('btn-primary').prop('disabled', true);
        validate(e);
      });
    }
  });

  $('.continue').on('click', async (e: any) => {
    e.preventDefault();
    $(e.target).trigger('blur');

    if ($(e.target).is('.btn-primary')) {
      currentStep++;

      if (currentStep === 5) {
        $('.create-steps').fadeOut(() => {
          $('.mining').fadeIn();
          createCommunity();
        });

        return;
      }

      $(`.step${currentStep - 1}`).fadeOut(() => {
        $(`.step${currentStep}`).fadeIn();

        $(e.target).prop('disabled', true);
        $('.back').removeClass('disabled');

        validate(e);
      });
    }
  });

  $(document).on('keyup', (e: any) => {
    validate(e);
  });

  $('#confirm, #aknowledge').on('change', (e) => {
    validate(e);
  });

  $('.add-holders').on('click', (e: any) => {
    e.preventDefault();

    $('.holders').find('tbody').append(`<tr>
      <td data-label="Wallet address">
        <input class="holder form-control" type="text">
      </td>
      <td data-label="Balance">
        <div class="input-group">  
          <input class="holder-balance input-number form-control" type="text" value="0">
          <span class="input-group-text ticker">${create.ticker}</span>
        </div>
      </td>
    </tr>`);
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
});
