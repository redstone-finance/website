import $ from '../libs/jquery';
import app from '../app';
import Opportunities from '../models/opportunities';
import Utils from '../utils/utils';
import moment from 'moment';
import Opportunity from '../models/opportunity';
import arweave from '../libs/arweave';
import Pager from '../utils/pager';

export default class PageOpportunity {
  private opportunities: Opportunities;
  private opps: Opportunity[];

  constructor() {
    this.opportunities = new Opportunities();
  }

  async open() {
    $('.page-opportunity').show();
    $('.link-opportunity').addClass('active');
    this.syncPageState();
  }

  async close() {
    $('.link-opportunity').removeClass('active');
    $('.page-opportunity').hide();
  }

  public async syncPageState() {
    $('.opps-link').attr('href', './opportunity.html');
    const pager = new Pager(
      await this.opportunities.getAllByCommunityIds([app.getCommunityId()]),
      $('.active').find('.card-footer'),
      10,
    );
    pager.onUpdate(async (p) => {
      await this.toHTML(p.items);
    });
    pager.setPage(1);
  }

  private async toHTML(opps) {
    console.log(opps);

    $('[data-total]').text(0);
    $('.bounty-type').find('[data-total="All"]').text(opps.length);
    console.log(opps);

    const state = await app.getCommunity().getState();
    let logo = '';
    if (state.settings.get('communityLogo')) {
      const config = arweave.api.getConfig();
      logo = `${config.protocol}://${config.host}:${config.port}/${state.settings.get('communityLogo')}`;
    }

    let html = '';
    for (let i = 0, j = opps.length; i < j; i++) {
      const opp = opps[i];

      const $type = $('.bounty-type').find(`[data-total="${opp.type}"]`);
      $type.text(+$type.text() + 1);

      const $exp = $('.exp-level').find(`[data-total="${opp.experience}"]`);
      $exp.text(+$exp.text() + 1);
      const $expTotal = $('.exp-level').find('[data-total="All"]');
      $expTotal.text(+$expTotal.text() + 1);

      html += `
      <a data-author="${opp.author.address}" data-opp-id="${
        opp.id
      }" class="jobs-job list-item" href="./opportunity.html#${opp.id}" target="_blank">
        <span class="avatar rounded" style="background-image: url(${logo})"></span>
        <div>
          <span class="text-body d-block">${opp.title}</span>
          <small class="d-block text-muted mt-n1"> 
            <ul class="list-inline list-inline-dots list-md-block mb-0">
              <li class="list-inline-item text-dark">${opp.community.name}</li>
              <li class="list-inline-item">${opp.type}</li>
              <li class="list-inline-item">${opp.experience}</li>
              <li class="list-inline-item">${moment(opp.timestamp).fromNow()}</li>
              <li class="list-inline-item">${opp.applicants.length}&nbsp;${
        opp.applicants.length === 1 ? 'applicant' : 'applicants'
      }</li>
            </ul>
          </small>
        </div>
        <span class="list-item-actions text-dark show">${Utils.formatNumber(+opp.payout)}&nbsp;${
        opp.community.ticker
      }</span>
      </a>`;
    }

    $('.jobs-list').html(html);
    $('.jobs-list').parents('.dimmer').removeClass('active');
  }
}
