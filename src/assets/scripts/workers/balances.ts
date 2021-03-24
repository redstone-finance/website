import { BalancesInterface, VaultInterface } from 'community-js/lib/faces';
export default class BalancesWorker {
  static async usersAndBalance(bal: BalancesInterface): Promise<{ users: string[]; balance: number }> {
    const users = Object.keys(bal);
    const balance = users.map((u) => bal[u]).reduce((a, b) => a + b, 0);

    return { users, balance };
  }

  static vaultUsersAndBalance(v: VaultInterface) {
    const vaultUsers = Object.keys(v);
    let vaultBalance = 0;
    for (let i = 0, j = vaultUsers.length; i < j; i++) {
      vaultBalance += v[vaultUsers[i]].map((a) => a.balance).reduce((a, b) => a + b, 0);
    }

    return { vaultUsers, vaultBalance };
  }

  static getAddressBalance(address: string, balances: BalancesInterface, vault: VaultInterface) {
    const unlocked = balances[address];

    let locked = 0;
    const userVault = vault[address];
    if (userVault) {
      for (let i = 0, j = userVault.length; i < j; i++) {
        locked += userVault[i].balance;
      }
    }

    return { balance: unlocked + locked, unlocked, vault: locked };
  }
}
