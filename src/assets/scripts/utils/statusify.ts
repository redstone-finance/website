/**
 * Starting at version 1.0.8 Toasts for transactions
 * are replaced by this Statusify feature.
 * Arweave GQL allow to read transactions instantly even
 * before being confirmed. Alertify is the way to go.
 */

import feather from 'feather-icons';
import $ from '../libs/jquery';
import { GQLEdgeInterface } from '../interfaces/gqlResult';
import Deferred from './deferred';
import arweave from '../libs/arweave';

type statusType = 'success' | 'error' | 'none' | 'pending';

export default class Statusify {
  private $elem: JQuery<HTMLElement>;
  private eventsStarted = false;

  private statuses: Map<
    string,
    {
      title: string;
      status: statusType;
      $elem: JQuery<HTMLElement>;
      deferred: Deferred;
    }
  > = new Map();

  private updateMS = 0;
  private globalStatus: statusType = 'none';

  constructor(statusifyParent: JQuery<HTMLElement> = $('.statusify'), updateMS = 10000) {
    this.$elem = statusifyParent;

    setTimeout(() => this.update(), updateMS);
    this.updateMS = updateMS;
  }

  async add(title: string, txid: string, error = false) {
    let stamp = `
    <span class="bg-yellow text-white stamp mr-3">
      <div class="spinner-border spinner-border-sm" role="status"></div>
    </span>`;

    if (error) {
      stamp = `
      <span class="bg-red text-white stamp mr-3">
        ${feather.icons.x.toSvg()}
      </span>`;
    }

    const $elem = $(`
    <div class="card-body d-flex align-items-center p-2 pt-1 pb-0">
      ${stamp}
      <div class="mr-3 lh-sm">
        <div class="strong">
          ${title}
        </div>
        <h5 class="text-muted">${txid}</h5>
      </div>
    </div>
    `);

    let deferred: Deferred;
    if (!this.statuses.has(txid)) {
      this.$elem.find('.card.card-sm').prepend($elem);

      deferred = new Deferred();
      this.statuses.set(txid, {
        title,
        status: error ? 'error' : 'pending',
        $elem,
        deferred,
      });

      if (this.globalStatus === 'none') {
        if (error) {
          this.globalStatus = 'error';
          $('.status-bg').addClass('badge bg-red');
        } else {
          this.globalStatus = 'pending';
          $('.status-bg').addClass('badge bg-yellow');
        }
        this.$elem.find('.card-body.empty').hide();
      }
    }

    if (!this.eventsStarted) {
      this.eventsStarted = true;
      this.events();
    }

    if (!deferred) {
      return false;
    }

    return deferred.promise;
  }

  private async update() {
    if (!this.statuses.size) {
      setTimeout(() => this.update(), this.updateMS);
      return;
    }

    const keys = Array.from(this.statuses.keys());
    const txids = [];
    for (let i = 0; i < keys.length; i++) {
      const status = this.statuses.get(keys[i]);
      if (status.status === 'pending') {
        txids.push(keys[i]);
      }
    }

    const query = {
      query: `
      query{
        transactions(
          ids: ${JSON.stringify(txids)}
        ){
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              block {
                timestamp
                height
              }
            }
          }
        }
      }`,
    };

    const res = await arweave.api.post('/graphql', query);
    const data: GQLEdgeInterface[] = res.data.data.transactions.edges;

    const foundTxs = [];
    let hasPending = false;
    for (let i = 0, j = data.length; i < j; i++) {
      const node = data[i].node;
      foundTxs.push(node.id);

      if (!node.block) {
        hasPending = true;
      } else {
        const status = this.statuses.get(node.id);
        status.status = 'success';
        status.deferred.resolve();
        status.$elem.find('.stamp').removeClass('bg-yellow').addClass('bg-green').html(feather.icons.check.toSvg());
      }
    }

    let hasError = false;
    for (let i = 0, j = txids.length; i < j; i++) {
      if (!foundTxs.includes(txids[i])) {
        hasError = true;

        const status = this.statuses.get(txids[i]);
        status.status = 'error';
        status.deferred.resolve();
        status.$elem.find('.stamp').removeClass('bg-yellow').addClass('bg-red').html(feather.icons.x.toSvg());
      }
    }

    if (this.globalStatus !== 'error') {
      if (hasError) {
        this.globalStatus = 'error';
        $('.status-bg').removeClass('bg-yellow bg-green').addClass('bg-red');
      } else if (hasPending) {
        this.globalStatus = 'pending';
        $('.status-bg').removeClass('bg-red bg-green').addClass('bg-yellow');
      } else {
        $('.status-bg').removeClass('bg-yellow bg-red').addClass('bg-green');
      }
    }

    setTimeout(() => this.update(), this.updateMS);
  }

  private events() {
    this.$elem.on('click', '.dropdown-menu', (e) => {
      e.stopPropagation();
    });

    this.$elem.on('hidden.bs.dropdown', () => {
      // Remove all confirmed and error elements
      const keys = Array.from(this.statuses.keys());
      for (let i = 0; i < keys.length; i++) {
        const status = this.statuses.get(keys[i]);
        if (status.status !== 'pending') {
          status.$elem.remove();
          this.statuses.delete(keys[i]);
        }
      }

      if (this.statuses.size) {
        this.globalStatus = 'pending';
        $('.status-bg').removeClass('bg-yellow').addClass('bg-yellow');
      } else {
        this.globalStatus = 'none';
        $('.status-bg').removeClass('badge bg-yellow bg-red bg-green');
        this.$elem.find('.card-body.empty').show();
      }
    });
  }
}
