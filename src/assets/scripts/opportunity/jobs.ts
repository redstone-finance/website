import 'quill/dist/quill.snow.css';

import moment from 'moment';
import jobboard from './jobboard';
import Utils from '../utils/utils';
import Opportunity from '../models/opportunity';
import Community from 'community-js';
import arweave from '../libs/arweave';

export default class PageJobs {
  private opps: Opportunity[] = [];
  private oppType = 'All';
  private oppExp = 'All';

  async open() {
    $('.bounty-type, .exp-level').removeClass('active');
    $('.bounty-type').first().addClass('active');
    $('.exp-level').first().addClass('active');
    $('.jobboard-jobs').show();

    await this.showAll();
    this.events();
  }

  async close() {
    await this.removeEvents();
    $('.jobboard-jobs').hide();
  }
  async syncPageState() {
    await this.showAll();
  }

  private async showAll() {
    this.opps = await jobboard.getOpportunities().getAll();

    $('.jobs-total-results').text(`${this.opps.length} results`);
    $('.bounty-type, .exp-level').find('[data-total="All"]').text(this.opps.length);

    await this.toHTML();
    $('.dimmer').removeClass('active');
  }

  private async toHTML() {
    const opps = this.opps;

    $('[data-total]').text(0);
    $('.bounty-type').find('[data-total="All"]').text(opps.length);

    let html = '';
    for (let i = 0, j = opps.length; i < j; i++) {
      const opp = opps[i];

      const $type = $('.bounty-type').find(`[data-total="${opp.type}"]`);
      $type.text(+$type.text() + 1);

      if (this.oppType !== 'All' && opp.type !== this.oppType) {
        continue;
      }
      if (this.oppExp !== 'All' && opp.experience !== this.oppExp) {
        continue;
      }

      const $exp = $('.exp-level').find(`[data-total="${opp.experience}"]`);
      $exp.text(+$exp.text() + 1);
      const $expTotal = $('.exp-level').find('[data-total="All"]');
      $expTotal.text(+$expTotal.text() + 1);

      html += `
      <a data-author="${opp.author.address}" data-opp-id="${opp.id}" class="jobs-job list-item" href="#${opp.id}">
        <span class="avatar rounded"></span>
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

    $('.jobs-job').each((i, el) => {
      const $job = $(el);
      const oppId = $job.attr('data-opp-id');

      jobboard
        .getOpportunities()
        .get(oppId)
        .then(async (opp) => {
          const comm = new Community(arweave);
          await comm.setCommunityTx(opp.community.id);
          const state = await comm.getState();
          console.log(state.settings);

          let logo = state.settings.get('communityLogo');
          if (logo && logo.length) {
            const config = arweave.api.getConfig();
            logo = `${config.protocol}://${config.host}:${config.port}/${logo}`;
          } else {
            logo = Utils.generateIcon(opp.community.id, 32);
          }
          $job.find('.avatar').attr('style', `background-image: url(${logo})`);
        });
    });

    $('.jobs-list').parents('.dimmer').removeClass('active');
  }

  private async events() {
    $('.bounty-type').on('click', (e) => {
      e.preventDefault();

      let $target = $(e.target);
      if (!$target.is('.bounty-type')) {
        $target = $target.parents('.bounty-type').first();
      }

      $('.bounty-type').removeClass('active');
      $target.addClass('active');

      $('.jobs-list').parents('.dimmer').addClass('active');
      this.oppType = $target.attr('data-type');
      return this.toHTML();
    });
    $('.exp-level').on('click', (e) => {
      e.preventDefault();

      let $target = $(e.target);
      if (!$target.is('.exp-level')) {
        $target = $target.parents('.exp-level').first();
      }

      $('.exp-level').removeClass('active');
      $target.addClass('active');

      this.oppExp = $target.attr('data-level');
      return this.toHTML();
    });

    $('.btn-filters').on('click', (e) => {
      e.preventDefault();

      $('.filters').toggleClass('d-none');
    });

    $('.btn-create-opp').on('click', async (e) => {
      if (!(await jobboard.getAccount().isLoggedIn())) {
        e.preventDefault();

        await jobboard.getAccount().showLoginError();
        return false;
      }
    });
  }
  private async removeEvents() {
    $('.bounty-type, .exp-level, .btn-filters, .btn-create-opp').off('click');
  }
}
