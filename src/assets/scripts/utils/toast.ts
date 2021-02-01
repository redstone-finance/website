import 'bootstrap/dist/js/bootstrap.bundle';
import feather from 'feather-icons';

import $ from '../libs/jquery';
import Utils from './utils';
import { TransactionStatusResponse } from 'arweave/node/transactions';
import arweave from '../libs/arweave';

export default class Toast {
  private t: any;

  show(title: string, message: string, type: 'error' | 'success' | 'none' | 'login', duration = 500) {
    const autohide: boolean = duration > 0;

    const bg = type === 'error' || type === 'login' ? 'bg-red' : type === 'success' ? 'bg-green' : 'bg-yellow';

    let icon = '<div class="spinner-border spinner-border-sm" role="status"></div>';
    switch (type) {
      case 'error':
        icon = feather.icons.x.toSvg();
        break;
      case 'success':
        icon = feather.icons.check.toSvg();
        break;
      case 'login':
        icon = feather.icons.user.toSvg();
        break;
    }

    let closeBtn = '';
    if (duration > 0) {
      closeBtn = `
      <button type="button" class="ml-2 close" data-dismiss="toast" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>`;
    }

    const html = `
    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true" data-autohide="${autohide}" data-delay="${duration}" data-toggle="toast">
      <div class="toast-header">
        <span class="avatar mr-2 ${bg} text-white">${icon}</span>
        <strong class="mr-auto">${title}</strong>
        ${closeBtn}
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
    `;

    this.t = $(html);
    $('.toast-container').append(this.t);
    this.t.toast('show');
  }

  async showTransaction(title: string, txid: string, data = {}) {
    let message = `
    <div class="mb-2">
      <div class="strong">Transaction ID</div>
      <h5 class="text-muted">${txid}</h5>
    </div>
    `;

    if (Object.keys(data).length) {
      const tmp = document.createElement('div');
      for (let key in data) {
        tmp.innerHTML = key;
        key = tmp.textContent || tmp.innerText || '';

        let value = data[key];
        tmp.innerHTML = value;
        value = tmp.textContent || tmp.innerText || '';

        if (typeof value === 'number') {
          value = await Utils.formatNumber(value);
        } else if (key === 'type' || key === 'key') {
          value = await Utils.capitalize(value);
        }

        if (key === 'Qty') {
          key = 'Quantity';
        }

        message += `
        <div class="mb-2">
          <div class="strong">${await Utils.capitalize(key)}</div>
          <h5 class="text-muted">${value}</h5>
        </div>`;
      }
    }

    this.show(title, message, 'none', 0);
    await this.checkTransaction(txid);
  }

  hide() {
    this.t.toast('hide');
  }

  private async checkTransaction(txid: string): Promise<void> {
    const res = await arweave.transactions.getStatus(txid);
    console.log(res);

    if (res.status !== 200 && res.status !== 202) {
      this.showFailTx(res);
      return;
    } else if (res.confirmed) {
      this.showSuccessTx();
      return;
    }

    await Utils.pause(15000);
    return this.checkTransaction(txid);
  }

  private async showSuccessTx() {
    this.showCloseBtn();
    this.t.find('.avatar').removeClass('bg-yellow').addClass('bg-green').html(feather.icons.check.toSvg());
  }

  private async showFailTx(res: TransactionStatusResponse) {
    console.log(res);

    this.showCloseBtn();
    this.t.find('.avatar').removeClass('bg-yellow').addClass('bg-red').html(feather.icons.x.toSvg());
  }

  private async showCloseBtn() {
    this.t.find('.toast-header').append(`
    <button type="button" class="ml-2 close" data-dismiss="toast" aria-label="Close">
      <span aria-hidden="true">&times;</span>
    </button>`);
  }
}
