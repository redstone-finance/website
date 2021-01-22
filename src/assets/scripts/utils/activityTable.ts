import { run } from "ar-gql";
import Community from "community-js";
import feather from 'feather-icons';

import { StateInterface } from "community-js/lib/faces";
import arweave from "../libs/arweave";
import Utils from "./utils";

export default class ActivityTable {
  private currentPage: number = 1;
  private limit: number = 10;
  private isMembersPage: boolean = true;
  private isAll: boolean = true;

  private hasNextPage: boolean = false;
  private cursor: string = '';
  
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
  } = {commId: [''], owners: [''], cursor: ''};

  constructor(gqlVariables: {commId: string[], owners: string[], cursor: string}, isMembersPage: boolean = true, limit: number = 10) {
    this.isMembersPage = isMembersPage;
    this.limit = limit;
    this.vars = gqlVariables;
    this.vars.cursor = '';
  }

  async show(forceUpdate: boolean = false) {
    await this.removeEvents();
    
    $('.act-cards').find('.dimmer').addClass('active');

    if(forceUpdate || ((this.currentPage*this.limit) >= this.items.length && this.hasNextPage) || !this.cursor.length) {
      await this.request();
    }

    const res = await Promise.all([this.showHeader(), this.showContent()]);
    $('.act-cards').find('.comm-activity').html(res.join(''));
    $('.act-cards').find('.card-footer').html(await this.showFooter());
    $('.act-cards').find('.dimmer.active').removeClass('active');

    this.events();
  }

  private async showHeader(): Promise<string> {
    return `
    <thead>
      <tr>
        <th>${(this.isMembersPage? 'Community' : 'Member')}</th>
        <th>Action</th>
        <th>Date</th>
      </tr>
    </thead>`;
  }
  private async showContent(): Promise<string> {
    let html = '<tbody>';

    if(!this.items.length) {
      return `<tr><td colspan="3" class="text-center">No activity logged for this ${(this.isMembersPage? 'member' : 'Community')}</td></tr>`;
    }

    const items = this.items.slice((this.currentPage - 1) * this.limit, this.currentPage * this.limit);

    for(let i = 0, j = items.length; i < j; i++) {
      const item = items[i];

      let state: StateInterface;
      if(this.isMembersPage) {
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
        <td data-label="${(this.isMembersPage? 'Community' : 'Member')}">
          <div class="d-flex lh-sm py-1 align-items-center">
            <span class="avatar mr-2" style="background-image: url(${item.avatar})"></span>
            <div class="flex-fill">
              <div class="strong text-nowrap">${item.name}</div>
              <a class="text-muted text-h5 text-nowrap" href="./${(this.isMembersPage? 'index' : 'member')}.html#${item.address}" target="_blank">${item.address}</a>
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
  private async showFooter(): Promise<string> {
    if(!this.items.length) return '';

    const pages = Math.ceil(this.items.length / this.limit);
    
    let html = `
    <ul class="pagination m-0 ml-auto">
      <li class="page-item ${(this.currentPage === 1? 'disabled' : '')}">
        <a class="prev-page page-link" href="#">
          ${feather.icons['chevron-left'].toSvg()} First
        </a>
      </li>`;

    for(let i = 0, j = pages; i < j; i++){
      const page = i+1;
      html += `
      <li class="page-item ${(this.currentPage === page? 'active' : '')}">
        <a href="#" class="page-link page-number">${page}</a>
      </li>`;
    }

    html += `
      <li class="page-item ${(pages > this.currentPage ? '' : 'disabled')}">
        <a class="next-page page-link" href="#">
          Next 
          ${feather.icons['chevron-right'].toSvg()}
        </a>
      </li>
    </ul>`;

    return html;
  }

  private async request() {
    this.items = [];

    let query = `
      query(${this.vars.commId.length ? '$commId: [String!]!, ' : ''}${this.vars.owners.length? '$owners: [String!]!, ' : ''} $cursor: String!) {
        transactions(
          tags: [
            ${this.isAll? '{ name: "Type", values: "ArweaveActivity" }' : '{ name: "Service", values: "CommunityXYZ" }'}
            ${this.vars.commId.length? '{ name: "Community-ID", values: $commId }' : ''}
          ]
          ${this.vars.owners.length? 'owners: $owners' : ''}
          first: 50
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

    console.log(query);
    console.log(this.vars);

    const res = await run(query, this.vars);
    const edges = res.data.transactions.edges;
    if(!edges.length) {
      return;
    }
    
    this.hasNextPage = res.data.transactions.pageInfo.hasNextPage;
    for(const tx of res.data.transactions.edges) {
      let comm: string;
      let message: string;
      for(const tag of tx.node.tags) {
        if(tag.name === 'Community-ID') {
          comm = tag.value;
        } else if(tag.name === 'Message') {
          message = tag.value;
        }
      }

      let name = tx.node.owner.address;
      let avatar = Utils.generateIcon(tx.node.owner.address);

      this.items.push({
        avatar,
        name,
        community: comm,
        address: this.isMembersPage? comm : tx.node.owner.address,
        message: message.replace(/[a-z0-9_-]{43}/ig, `<a href="./member.html#$&" target="_blank"><code>$&</code></a>`),
        date: (new Date(tx.node.block.timestamp * 1000)).toLocaleString()
      });

      this.cursor = tx.cursor;
    }

    return this.items;
  }

  private async events() {
    $('.act-cards').on('change', '.act-filter', e => {
      const $filter = $('.act-cards').find('.act-filter');
      if($filter.is(':checked')) {
        this.isAll = true;
      } else {
        this.isAll = false;
      }
      this.show(true);
    });

    $('.act-cards').on('click', '.page-link', e => {
      e.preventDefault();

      if($(e.target).hasClass('disabled')) return;

      if($(e.target).hasClass('next-page')) {
        this.currentPage++;
        this.show();
      } else if($(e.target).hasClass('prev-page')) {
        this.cursor = '';
        this.currentPage = 1;
        this.hasNextPage = false;
        this.show();
      } else if($(e.target).hasClass('page-number')) {
        this.currentPage = +$(e.target).text();
        this.show();
      }
    });
  }
  private async removeEvents() {
    $('.act-cards').off('click').off('change');
  }
}