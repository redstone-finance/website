import '../styles/style.scss';

import Community from 'community-js';
import $ from './libs/jquery';
import 'bootstrap/dist/js/bootstrap.bundle';

import './global';
import Account from './models/account';
import arweave from './libs/arweave';
import Toast from './utils/toast';
import Utils from './utils/utils';

const community = new Community(arweave);
const account = new Account(community);

// @ts-ignore
window.currentPage = {
  syncPageState: async () => {
    if (await account.isLoggedIn()) {
      $('.logged-in-addy').text(await account.getAddress());
      $('.ref-link').text(`https://community.xyz/claim#${await account.getAddress()}`);
      $('.logged-in').show();
    } else {
      $('.logged-out').hide();
    }
  },
};

$(() => {
  $('a.home').attr('href', '/home.html');
  $('a.create').attr('href', './create.html');
  $('a.opp').attr('href', './opportunity.html');
  $('a.comms').attr('href', './communities.html');
  $('a.ref-link').on('click', (e) => {
    e.preventDefault();

    Utils.copyToClipboard($('a.ref-link').text().toString().trim());
  });

  $('.claim').on('click', async (e) => {
    e.preventDefault();

    const toast = new Toast();
    const $claim = $('.claim');

    $claim.addClass('btn-loading disabled');

    const ref = document.location.hash.replace('#', '').trim();
    $.post(
      './completeclaim',
      {
        wallet: await account.getWallet(),
        ref,
      },
      (res) => {
        if (res.startsWith('OK-')) {
          const txid = res.replace('OK-', '').trim();
          $('.txid').attr('href', `https://viewblock.io/arweave/tx/${txid}`).text(txid);

          $claim.hide();
          $('.confirmed').show();

          toast.show('Claimed', 'Tokens claimed!', 'success', 3000);
        } else if (res === 'DONE') {
          toast.show('Error', 'Tokens already claimed!', 'error', 3000);
        } else {
          toast.show('Error', res, 'error', 3000);
        }

        $claim.removeClass('disabled btn-loading');
      },
    );
  });

  account.init();
});
