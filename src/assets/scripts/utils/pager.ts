import feather from "feather-icons";

export interface PagerResultInterface {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  startPage: number;
  endPage: number;
  startIndex: number;
  endIndex: number;
  pages: number[];
  items: any[];
}

export default class Pager {
  private items: any[] = [];
  private limit: number = 10;
  private handler: (pager: PagerResultInterface) => void = () => {};
  private $pagination: JQuery<HTMLElement>;
  private pager: PagerResultInterface;

  constructor(items: any[], $pagination: JQuery<HTMLElement>, limit: number = 10) {
    this.items = items;
    this.limit = limit > 1 ? limit : 1;
    this.$pagination = $pagination;

    this.events();
  }

  setLimit(limit: number) {
    this.limit = limit;
  }

  async setPage(page: number = 1): Promise<PagerResultInterface> {
    const totalPages = Math.ceil(this.items.length / this.limit);

    if(page < 1 || page > totalPages) {
      return;
    }

    const currentPage = page;
    let startPage = 1;
    let endPage = totalPages;

    if(totalPages <= 10) {
      startPage = 1;
      endPage = totalPages;
    } else {
      if (currentPage <= 6) {
        startPage = 1;
        endPage = 10;
      } else if (currentPage + 4 >= totalPages) {
        startPage = totalPages - 9;
        endPage = totalPages;
      } else {
        startPage = currentPage - 5;
        endPage = currentPage + 4;
      }
    }

    const startIndex = (currentPage - 1) * this.limit;
    const endIndex = Math.min(startIndex + this.limit - 1, this.items.length - 1);

    const items = this.items.slice(startIndex, endIndex + 1);

    const pages: number[] = [];
    for(let i = startPage, j = endPage + 1; i < j; i++) {
      pages.push(i);
    }

    this.pager = {
      totalItems: this.items.length,
      currentPage,
      pageSize: this.limit,
      totalPages,
      startPage,
      endPage,
      startIndex,
      endIndex,
      pages,
      items
    };

    this.updateHtml();
    return this.pager;
  }

  async updateHtml() {
    let html = `
    <ul class="pagination m-0 ml-auto">
      <li class="page-item ${this.pager.currentPage === 1 ? 'disabled' : ''}">
        <a class="prev-page page-link" href="#">
          ${feather.icons['chevron-left'].toSvg()} First
        </a>
      </li>`;

    for (const page of this.pager.pages) {
      html += `
      <li class="page-item ${this.pager.currentPage === page ? 'active' : ''}">
        <a href="#" class="page-link page-number">${page}</a>
      </li>`;
    }

    html += `
      <li class="page-item ${this.pager.totalPages > this.pager.currentPage ? '' : 'disabled'}">
        <a class="next-page page-link" href="#">
          Last 
          ${feather.icons['chevron-right'].toSvg()}
        </a>
      </li>
    </ul>`;

    this.$pagination.html(html);
    this.handler(this.pager);
  }

  async onUpdate(handler: (pager?: PagerResultInterface) => void) {
    this.handler = handler;
  }

  private async events() {
    this.$pagination.off('click').on('click', '.page-link', (e) => {
      e.preventDefault();

      if ($(e.target).hasClass('disabled')) return;

      if ($(e.target).hasClass('next-page')) {
        this.pager.currentPage = this.pager.totalPages;
      } else if ($(e.target).hasClass('prev-page')) {
        this.pager.currentPage = 1;
      } else if ($(e.target).hasClass('page-number')) {
        this.pager.currentPage = +$(e.target).text();
      }
      this.setPage(this.pager.currentPage);
    });
  }
}