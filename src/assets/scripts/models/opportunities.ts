import Opportunity from './opportunity';
import Arweave from 'arweave';

export default class Opportunities {
  private oppsMap: Map<string, Opportunity> = new Map();
  private oppsArr: Opportunity[] = [];

  /**
   * Get all the opportunites, updated, sorted and with all the applicants.
   * By default the data isn't available.
   */
  async getAll(): Promise<Opportunity[]> {
    // Check if there is only 1 opp loaded, if there is, load everything again to make sure it's right.
    if (this.oppsMap.size < 2) {
      this.oppsArr = await Opportunity.getAll();
      for (let i = 0, j = this.oppsArr.length; i < j; i++) {
        this.oppsMap.set(this.oppsArr[i].id, this.oppsArr[i]);
      }
    }

    return this.oppsArr;
  }

  async getAllByCommunityIds(commIds: string[]): Promise<Opportunity[]> {
    if (this.oppsMap.size < 2) {
      this.oppsArr = await Opportunity.getAll(commIds);
      for (let i = 0, j = this.oppsArr.length; i < j; i++) {
        this.oppsMap.set(this.oppsArr[i].id, this.oppsArr[i]);
      }

      return this.oppsArr;
    }

    const res: Opportunity[] = [];
    for (let i = 0, j = this.oppsArr.length; i < j; i++) {
      if (commIds.includes(this.oppsArr[i].community.id)) {
        res.push(this.oppsArr[i]);
      }
    }
    return res;
  }

  async get(id: string, reload = false): Promise<Opportunity> {
    let opp = this.oppsMap.get(id);
    if (!opp) {
      opp = await Opportunity.getOpportunity(id);
      if (opp) {
        this.oppsArr.push(opp);
        this.oppsMap.set(id, opp);
        this.oppsArr.sort((a, b) => b.timestamp - a.timestamp);
      }
    } else if (reload) {
      await opp.update();
      this.oppsMap.set(id, opp);
      this.oppsArr = Array.from(this.oppsMap.values());
      this.oppsArr.sort((a, b) => b.timestamp - a.timestamp);
    }

    return opp;
  }

  /**
   * Remove an opportunity from the list with the specified ID.
   * @param id The Opportunity ID to remove
   * @returns The removed opportunity
   */
  async remove(id: string): Promise<Opportunity> {
    const removed: Opportunity = this.oppsMap.get(id);
    if (removed) {
      this.oppsMap.delete(id);
      this.oppsArr = Array.from(this.oppsMap.values());
      this.oppsArr.sort((a, b) => b.timestamp - a.timestamp);
    }

    return removed;
  }
}
