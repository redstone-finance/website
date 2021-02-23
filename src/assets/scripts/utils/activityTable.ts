import { run } from 'ar-gql';
import Community from 'community-js';
import feather from 'feather-icons';

import { StateInterface } from 'community-js/lib/faces';
import arweave from '../libs/arweave';
import Utils from './utils';
import Pager from './pager';

export default class ActivityTable {
  private currentPage = 1;
  private isMembersPage = true;
  private isAll = true;

  private hasNextPage = false;

  private items: {
    avatar: string;
    name: string;
    community: string;
    address: string;
    message: string;
    date: string;
  }[] = [];

  private vars: {
    commId: string[];
    owners: string[];
    cursor: string;
  } = { commId: [''], owners: [''], cursor: '' };

  constructor(
    gqlVariables: { commId: string[]; owners: string[]; cursor: string },
    isMembersPage = true,
    limit = 10,
  ) {
    this.isMembersPage = isMembersPage;
    this.vars = gqlVariables;
    this.vars.cursor = '';
  }

  async show(forceUpdate = false) {
    await this.removeEvents();

    $('.act-cards').find('.dimmer').addClass('active');

    if (
      forceUpdate ||
      (this.currentPage >= this.items.length && this.hasNextPage)
    ) {
      await this.request();
    }

    const pager = new Pager(this.items, $('.act-cards').find('.card-footer'), 10);
    pager.onUpdate(async (p) => {
      console.log(p);
      this.currentPage = p.currentPage;
      const res = await Promise.all([this.showHeader(), this.showContent(p.items)]);
      $('.act-cards').find('.comm-activity').html(res.join(''));
      $('.act-cards').find('.dimmer.active').removeClass('active');
  });
  pager.setPage(1);
    this.events();
  }

  private async showHeader(): Promise<string> {
    return `
    <thead>
      <tr>
        <th>${this.isMembersPage ? 'Community' : 'Member'}</th>
        <th>Action</th>
        <th>Date</th>
      </tr>
    </thead>`;
  }
  private async showContent(itemss): Promise<string> {
    let html = '<tbody>';

    if (!this.items.length) {
      return `<tr><td colspan="3" class="text-center">No activity logged for this ${
        this.isMembersPage ? 'member' : 'Community'
      }</td></tr>`;
    }

    const items = itemss;
    
    for (let i = 0, j = items.length; i < j; i++) {
      const item = items[i];

      let state: StateInterface;
      if (this.isMembersPage) {
        try {
          const community = new Community(arweave);
          await community.setCommunityTx(item.community);
          state = await community.getState(true);
        } catch (e) {
          console.log(e);
          continue;
        }
        item.name = `${state.name} (${state.ticker})`;

        let logo = state.settings.get('communityLogo');
        if (logo && logo.length) {
          const config = arweave.api.getConfig();
          logo = `${config.protocol}://${config.host}:${config.port}/${logo}`;
        } else {
          logo = Utils.generateIcon(item.community, 32);
        }
        item.avatar = logo;
      }

      html += `
      <tr>
        <td data-label="${this.isMembersPage ? 'Community' : 'Member'}">
          <div class="d-flex lh-sm py-1 align-items-center">
            <span class="avatar mr-2" style="background-image: url(${item.avatar})"></span>
            <div class="flex-fill">
              <div class="strong text-nowrap">${item.name}</div>
              <a class="text-muted text-h5 text-nowrap" href="./${this.isMembersPage ? 'index' : 'member'}.html#${
        item.address
      }" target="_blank">${item.address}</a>
            </div>
          </div>
        </td>
        <td class="text-muted" data-label="Action">
          ${item.message}
        </td>
        <td class="text-muted" data-label="Date">
          ${item.date}
        </td>
      </tr>`;
    }
    html += '</tbody>';
    return html;
  }

  private async request() {
    let hasNextPage = true;
    this.items = [];

    while (hasNextPage) {
    const query = `
      query(${this.vars.commId.length ? '$commId: [String!]!, ' : ''}${
      this.vars.owners.length ? '$owners: [String!]!, ' : ''
    } $cursor: String!) {
        transactions(
          tags: [
            ${
              this.isAll ? '{ name: "Type", values: "ArweaveActivity" }' : '{ name: "Service", values: "CommunityXYZ" }'
            }
            ${this.vars.commId.length ? '{ name: "Community-ID", values: $commId }' : ''}
          ]
          ${this.vars.owners.length ? 'owners: $owners' : ''}
          first: 100
          after: $cursor
        ) {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              tags {
                name
                value
              }
              owner {
                address
              }
              block {
                timestamp
              }
            }
          }
        }
      }
    `;

    const res = await run(query, this.vars);
    const edges = res.data.transactions.edges;
    if (!edges.length) {
      return;
    }

    for (const tx of res.data.transactions.edges) {
      let comm: string;
      let message: string;
      for (const tag of tx.node.tags) {
        if (tag.name === 'Community-ID') {
          comm = tag.value;
        } else if (tag.name === 'Message') {
          message = tag.value;
        }
      }
      
      const name = tx.node.owner.address;
      const avatar = Utils.generateIcon(tx.node.owner.address);
      
      let d = new Date();
      if(tx.node.block && tx.node.block.timestamp) {
        d = new Date(tx.node.block.timestamp * 1000);
      }
      
      this.items.push({
        avatar,
        name,
        community: comm,
        address: this.isMembersPage ? comm : tx.node.owner.address,
        message: message.replace(/[a-z0-9_-]{43}/gi, `<a href="./member.html#$&" target="_blank"><code>$&</code></a>`),
        date: d.toLocaleString(),
      });
    }
    this.vars.cursor=res.data.transactions.edges[res.data.transactions.edges.length-1].cursor
    hasNextPage = res.data.transactions.pageInfo.hasNextPage;
  }
  return this.items;
}

  private async events() {
    $('.act-cards').on('change', '.act-filter', (e) => {
      const $filter = $('.act-cards').find('.act-filter');
      if ($filter.is(':checked')) {
        this.isAll = true;
      } else {
        this.isAll = false;
      }
      this.show(true);
    });
  }
  private async removeEvents() {
    $('.act-cards').off('change');
  }
}
