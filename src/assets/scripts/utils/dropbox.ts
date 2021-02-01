import feather from 'feather-icons';
import Deferred from './deferred';
import { JWKInterface } from 'arweave/node/lib/wallet';
import arweave from '../libs/arweave';
import Toast from './toast';

export default class Dropbox {
  private $container: JQuery<HTMLElement>;
  private $elem: JQuery<HTMLElement>;
  private eventsStarted = false;
  private deferred: Deferred;

  constructor($container: JQuery<HTMLElement>) {
    this.$container = $container;
  }

  async show(
    text = 'Drag and drop a file or click to deploy.',
    icon = 'upload-cloud',
    isWallet = false,
    accept = [],
  ) {
    const klass = isWallet ? 'file-upload-default' : '';
    this.$elem = $(`
    <div class="col-12 deployer text-center">
      <input type="file" class="${klass}" accept="${accept.join(',')}" />
      <span>${feather.icons[icon].toSvg()}<br/>${text}<span>
    </div>`);

    this.$container.empty().append(this.$elem);

    await this.events();

    this.deferred = new Deferred();
    return this.deferred.promise;
  }

  async showLogin() {
    return this.show('Drag and drop your wallet or click to login.', 'key', true);
  }

  async showAndDeploy(wallet: JWKInterface, allowedTypes: string[] = ['image/*']) {
    // This method will show the dropbox box and deploy
    // the file to Arweave using the current account.
    const e = await this.show('Drag and drop a file or click to deploy.', 'upload-cloud', false, allowedTypes);

    const deferred = new Deferred();
    const fileReader = new FileReader();
    fileReader.onload = async (ev) => {
      const contentType = (e.target as any).files[0].type;
      if (allowedTypes.length && !allowedTypes.includes(`${contentType.split('/')[0]}/*`)) {
        const toast = new Toast();
        toast.show('Error', 'Must be an image.', 'error', 3000);
        return deferred.resolve(false);
      }
      const fileContent = ev.target.result as ArrayBuffer;

      const tx = await arweave.createTransaction({ data: fileContent }, wallet);
      tx.addTag('Content-Type', contentType);
      tx.addTag('App-Name', 'CommunityXYZ');
      tx.addTag('Type', 'FileUpload');

      await arweave.transactions.sign(tx, wallet);
      const id = tx.id;
      const res = await arweave.transactions.post(tx);

      if (res.status != 200) {
        const toast = new Toast();
        toast.show('Error', 'Failed ArWeave transaction.', 'error', 3000);
        return deferred.resolve(false);
      }
      return deferred.resolve(id);
    };
    fileReader.readAsArrayBuffer((e.target as any).files[0]);

    return deferred.promise;
  }

  private async events() {
    this.$elem.find('input[type="file"]').on('change', (e) => {
      e.stopPropagation();

      // @ts-ignore
      this.deferred.resolve(e);
    });
    this.$elem
      .on('dragenter, dragover', (e) => {
        this.$elem.addClass('highlight');
      })
      .on('dragleave, drop', (e) => {
        this.$elem.removeClass('highlight');
      });
  }
}
