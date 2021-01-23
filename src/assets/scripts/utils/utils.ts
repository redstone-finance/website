import jdenticon from 'jdenticon';
import Toast from './toast';

export default class Utils {
  static async pause(timeout: number = 500) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), timeout);
    });
  }

  static async capitalize(str: string) {
    try {
      str = str.replace(/([A-Z])/g, ' $1').replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    } catch (e) {}

    return str;
  }

  static async isArTx(str: string): Promise<boolean> {
    return /^[a-z0-9-_]{43}$/i.test(str);
  }

  static formatNumber(amount: number, decimalCount = 0, decimal = '.', thousands = ',') {
    try {
      decimalCount = Math.abs(decimalCount);
      decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

      const negativeSign = amount < 0 ? '-' : '';

      const i = parseInt((Math.abs(Number(amount) || 0)).toFixed(decimalCount), 10).toString();
      const j = i.length > 3 ? i.length % 3 : 0;

      return (
        negativeSign +
        (j ? i.substr(0, j) + thousands : '') +
        i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + thousands) +
        (decimalCount
          ? decimal +
            Math.abs(amount - +i)
              .toFixed(decimalCount)
              .slice(2)
          : '')
      );
    } catch (e) {
      console.log(e);
    }
  }

  static formatBlocks(len: number = 720): string {
    const hour = 30;
    const day = 720;
    const week = 720 * 7;
    const month = week * 4;
    const year = month * 12;

    let res = '';
    if (len >= year) {
      const years = Math.round(len / year);
      res = `~${years} ${years === 1 ? 'year' : 'years'}`;
    } else if (len >= month) {
      const months = Math.round(len / month);
      res = `~${months} ${months === 1 ? 'month' : 'months'}`;
    } else if (len >= day) {
      const days = Math.round(len / day);
      res = `~${days} ${days === 1 ? 'day' : 'days'}`;
    } else if (len >= hour) {
      const hours = Math.round(len / hour);
      res = `~${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
      res = '<1 hour';
    }

    return res;
  }

  static stripTags(str: any) {
    if (typeof str === 'object') {
      for (let key in str) {
        str[this.stripTags(key)] = this.stripTags(str[key]);
      }
    }

    return str;
  }

  static generateIcon(str: string, size: number = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    jdenticon.drawIcon(canvas.getContext('2d'), str, size);

    return canvas.toDataURL();
  }

  static stripHTML(str: string) {
    return str.replace(/<\/?[^>]*>/gi, '');
  }

  static escapeScriptStyles(str: string) {
    str = str.replace(/onload="?[^>]+/gi, '');
    return str.replace(/<(\/?(script|style|iframe))[^>]*>/gi, '&lt;$1$2&gt;');
  }

  static copyToClipboard(str: string) {
    const $temp = $('<input>');
    $('body').append($temp);
    $temp.val(str).trigger('select');
    document.execCommand('copy');
    $temp.remove();

    const toast = new Toast();
    toast.show('Copied', 'Copied to your clipboard', 'success', 1000);
  }
}
