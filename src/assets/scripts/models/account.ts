import { JWKInterface } from 'arweave/web/lib/wallet';
import feather from 'feather-icons';

import $ from '../libs/jquery';
import Toast from '../utils/toast';
import Community from 'community-js';
import arweave from '../libs/arweave';
import communityDB from '../libs/db';
import Author from './author';
import Dropbox from '../utils/dropbox';

export default class Account {
  private community: Community;

  private loggedIn = false;
  private wallet: JWKInterface;
  private username = '';
  private avatar = '';
  private address = '';
  private arBalance = -1;
  private isInitialized = false;
  private verified = null;

  constructor(community: Community) {
    this.community = community;
  }

  async init() {
    try {
      this.address = await window.arweaveWallet.getActiveAddress();
      this.loadAddress();
    } catch(e) {}

    try {
      const sess = atob(communityDB.get('sesswall'));
      if (sess) {
        await this.loadWallet(JSON.parse(sess));
      }
    } catch (e) {
      console.log(e);
    }

    await this.initWallet();

    this.events();
    this.isInitialized = true;
  }

  async getArweaveId() {
    return { name: this.username, address: this.address };
  }
  async getAvatar(): Promise<string> {
    return this.avatar;
  }
  async isLoggedIn(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.init();
    }

    return this.loggedIn;
  }
  async getVerify() {
    // this.verified = await getVerification(this.address);
    return this.verified;
  }

  async getWallet(): Promise<JWKInterface> {
    return this.wallet;
  }
  async getAddress(): Promise<string> {
    return this.address;
  }

  async getArBalance(): Promise<number> {
    if (!this.loggedIn) return 0;

    this.arBalance = +arweave.ar.winstonToAr(await arweave.wallets.getBalance(this.address), {
      formatted: false,
      decimals: 5,
      trim: true,
    });
    return this.arBalance;
  }

  async showLoginError(duration = 5000) {
    const toast = new Toast();
    toast.show('Login first', 'Before being able to do this action you need to login.', 'login', duration);
  }

  // Private methods
  private async initWallet() {
    if ($('.login-box').length) {
      const deployer = new Dropbox($('.login-box'));
      deployer.showLogin().then(async (e) => {
        await this.login(e);
        this.initWallet();
      });
    }
  }
  private async loadWallet(wallet: JWKInterface) {
    this.wallet = wallet;

    
    this.address = await this.community.setWallet(wallet);
    this.loadAddress();

    // @ts-ignore
    window.currentPage.syncPageState();
  }

  private async loadAddress() {
    const bal = await arweave.wallets.getBalance(this.address);
    const arBalance = arweave.ar.winstonToAr(bal, {
      formatted: false,
      decimals: 5,
      trim: true,
    });
    this.arBalance = +arBalance;

    const account = new Author(null, this.address, null);
    const acc = await account.getDetails();
    this.username = acc.name;
    this.avatar = acc.avatar;

    $('.user-name').text(this.username);
    $('.user-avatar').css('background-image', `url(${this.avatar})`);
    $('.member-profile').attr('href', `./member.html#${this.address}`);

    $('.member-ar').removeAttr('href').html(`${feather.icons['dollar-sign'].toSvg({ class: 'icon' })} ${this.arBalance} AR`);

    if (this.address) {
      this.loggedIn = true;
      // @ts-ignore
      $('#login-modal').modal('hide');
      $('.loggedin').show();
      $('.loggedout').hide();
    }
  }

  // private async loadVerify() {
  //   const verifys = await this.getVerify();
  //   if (verifys.verified) {
  //     $('.member-verify').html(verifys.icon + 'verified');
  //     $('.member-verify:first').addClass('icon.dropdown-item-icon');
  //   } else {
  //     $('.member-verify').html(verifys.icon + '&nbsp' + ' Verify');
  //     $('.member-verify:first').addClass('icon.dropdown-item-icon');
  //     //const uri = await verify(this.wallet, window.location.href, this.address);
  //     //console.log(uri);
  //   }
  // }

  private async login(e: any) {
    if (e.target && e.target.files) {
      return new Promise((resolve) => {
        const fileReader = new FileReader();
        fileReader.onload = async (ev: any) => {
          await this.loadWallet(JSON.parse(fileReader.result.toString()));

          if (this.address.length && this.arBalance >= 0) {
            let isError = false;
            try {
              communityDB.set('sesswall', btoa(fileReader.result.toString()));
            } catch (err) {
              console.log(err);
              isError = true;
            }

            if (isError) {
              try {
                communityDB.clearAll();
                resolve(this.login(e));
              } catch (err) {
                console.log(err);
              }
            }
          }

          resolve(true);
        };
        fileReader.readAsText(e.target.files[0]);
      });
    }

    return false;
  }

  private events() {
    $('.file-upload-default').on('change', (e: any) => {
      this.login(e);
    });

    $('.ar-connect').off('click').on('click', async e => {
      e.preventDefault();

      await window.arweaveWallet.connect([
        'ACCESS_ADDRESS',
        'SIGN_TRANSACTION'
      ], {
        name: 'TODO List'
      });

      try {
        this.address = await window.arweaveWallet.getActiveAddress();
      } catch(e) {}
    });

    $('.logout').on('click', async (e: any) => {
      e.preventDefault();

      $('.loggedin').hide();
      $('.loggedout').show();

      this.loggedIn = false;
      this.wallet = null;
      this.username = '';
      this.avatar = '';
      this.address = '';
      this.arBalance = 0;

      //@ts-ignore
      window.currentPage.syncPageState();
      communityDB.remove('sesswall');

      // Set a dummy wallet address
      this.community.setWallet(await arweave.wallets.generate());
    });
  }
}
