import ArDB from 'ardb';
import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'arweave.net',
  protocol: 'https',
  port: 443,
  timeout: 100000,
});

// @ts-ignore
export default window.arweave = arweave;

export const ardb = new ArDB(arweave);
