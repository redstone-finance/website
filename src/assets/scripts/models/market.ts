import Verto from '@verto/lib';
import { JWKInterface } from 'arweave/web/lib/wallet';
import Community from 'community-js';
import arweave from '../libs/arweave';
import Toast from '../utils/toast';

export default class Market {
  private client: Verto;
  private communityId: string;
  private community: Community;
  private tradingPost: string;
  private orders: { amnt: number; rate: number }[];

  constructor(communityId: string, keyfile: JWKInterface) {
    this.client = new Verto(keyfile);
    this.communityId = communityId;
    this.community = new Community(arweave);
  }

  async getAVGPrice() {
    this.tradingPost = await this.client.recommendPost();

    const query = {
      query: `
      query {
        transactions(
          owners: ["${this.tradingPost}"]
          tags: [
            { name: "Type", values: "Genesis" }
          ]
          first: 1
        ) {
          edges {
            node {
              id
            }
          }
        }
      }`,
    };

    const res = (await arweave.api.post('/graphql', query)).data;
    const tpUri = (await arweave.api.get(`/${res.data.transactions.edges[0].node.id}`)).data.publicURL;
    const datas = (await arweave.api.request().get(`https://${tpUri}/orders`)).data;

    const sellOrders = [];
    this.orders = [];
    for (let i = 0, j = datas.length; i < j; i++) {
      const data = datas[i];
      if (data.token === this.communityId) {
        for (let j = 0, k = data.orders.length; j < k; j++) {
          if (data.orders[j].type.toLowerCase() === 'sell') {
            this.orders.push(data.orders[j]);
            sellOrders.push(1 / data.orders[j].rate);
          }
        }
        break;
      }
    }

    await this.community.setCommunityTx(this.communityId);
    const state = await this.community.getState();

    const avg = +(sellOrders.reduce((a, b) => a + b, 0) / sellOrders.length).toFixed(5);

    if (avg) {
      $('.avg-price').html(`
      <div class="mb-3">
        <a href="#" class="tokens-buy-btn btn btn-dark btn-block">Buy</a>
      </div>
      Average rate is of <strong>${avg} AR/${state.ticker}</strong>.
      `);
      $('.tokens-buy-btn')
        .off('click')
        .on('click', async (e) => {
          e.preventDefault();
          $(e.target).addClass('btn-loading');
          await this.buyOrder();
          $(e.target).removeClass('btn-loading');
          // @ts-ignore
          $('#verto-modal').modal('hide');
        });
    } else {
      $('.avg-price').html("<strong>There aren't any buy orders open.</strong>");
    }
  }

  async showBuyButton() {
    this.getAVGPrice();

    $('.market-btn').each((i, e) => {
      const $btn = $(e);
      $btn
        .removeClass('disabled')
        .off('click')
        .on('click', (e) => {
          e.preventDefault();

          $('.tokens-btn')
            .off('click')
            .on('click', async (e) => {
              e.preventDefault();
              $(e.target).addClass('btn-loading');
              await this.buyOrder();
              $(e.target).removeClass('btn-loading');
              // @ts-ignore
              $('#verto-modal').modal('hide');
            });

          // @ts-ignore
          $('#verto-modal').modal('show');
        });
    });
  }

  async showSellButton() {
    $('.market-sell-btn').each((i, e) => {
      const $btn = $(e);
      $btn
        .removeClass('disabled')
        .off('click')
        .on('click', (e) => {
          e.preventDefault();

          $('.tokens-sell-btn')
            .off('click')
            .on('click', async (e) => {
              e.preventDefault();
              $(e.target).addClass('btn-loading');
              await this.sellOrder();
              $(e.target).removeClass('btn-loading');
              // @ts-ignore
              $('#verto-sell-modal').modal('hide');
            });

          // @ts-ignore
          $('#verto-sell-modal').modal('show');
        });
    });
  }

  async hideBuyButton() {
    // @ts-ignore
    $('#verto-modal').modal('hide');
    $('.market-btn').addClass('disabled').off('click');
  }

  async hideSellButton() {
    // @ts-ignore
    $('#verto-sell-modal').modal('hide');
    $('.market-sell-btn').addClass('disabled').off('click');
  }

  async buyOrder() {
    const amount = +$('#verto-amount').val().toString().trim();
    const toast = new Toast();

    if (amount <= 0) {
      toast.show('Error', 'Invalid buy order amount.', 'error', 3000);
      return;
    }

    let sum = 0;
    for (const order of this.orders) {
      sum += order.amnt / order.rate;
    }
    if (amount > sum) {
      toast.show('Error', 'Buying more than the orderbook allows.', 'error', 3000);
      return;
    }

    const order = await this.client.createOrder('buy', amount, this.communityId, this.tradingPost);
    if (order === 'ar') {
      toast.show('Error', "You don't have enough AR to complete this order.", 'error', 3000);
      return;
    }

    // @ts-ignore
    await this.client.sendOrder(order.txs);
    toast.show('Submitted', 'The order was successfully submitted.', 'success', 3000);
    return true;
  }

  async sellOrder() {
    this.tradingPost = await this.client.recommendPost();
    const amount = +$('#verto-sell-amount').val().toString().trim();
    const rate = +$('#verto-sell-rate').val().toString().trim();
    const toast = new Toast();

    if (amount <= 0) {
      toast.show('Error', 'Invalid sell order amount.', 'error', 3000);
      return;
    }
    if (rate <= 0) {
      toast.show('Error', 'Invalid sell order rate.', 'error', 3000);
    }

    const order = await this.client.createOrder('sell', amount, this.communityId, this.tradingPost, rate);
    if (order === 'ar') {
      toast.show('Error', "You don't have enough AR to complete this order.", 'error', 3000);
      return;
    }
    if (order === 'pst') {
      toast.show('Error', "You don't have enough tokens to complete this order", 'error', 3000);
      return;
    }

    // @ts-ignore
    await this.client.sendOrder(order.txs);
    toast.show('Submitted', 'The order was successfully submitted.', 'success', 3000);
    return true;
  }
}
