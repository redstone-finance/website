import { GQLNodeInterface } from '../interfaces/gqlResult';
import OpportunityInterface from '../interfaces/opportunity';
export default class OpportunitiesWorker {
  static async nodeToOpportunity(node: GQLNodeInterface): Promise<OpportunityInterface> {
    function stripTags(str: any) {
      if (typeof str === 'object') {
        for (const key in str) {
          str[this.stripTags(key)] = this.stripTags(str[key]);
        }
      }

      return str;
    }

    // Default object
    const objParams: any = {};
    for (let i = 0, j = node.tags.length; i < j; i++) {
      objParams[stripTags(node.tags[i].name)] = stripTags(node.tags[i].value);
    }

    return {
      id: node.id,
      title: objParams.title,
      community: {
        id: objParams.communityId,
        name: objParams.communityName,
        ticker: objParams.communityTicker,
      },
      description: '',
      payout: objParams.payout,
      lockLength: +objParams.lockLength || 0,
      type: objParams.jobType,
      experience: objParams.expLevel,
      commitment: objParams.commitment,
      project: objParams.project,
      permission: objParams.permission,
      owner: node.owner.address,
      author: null,
      timestamp: node.block && node.block.timestamp ? node.block.timestamp * 1000 : new Date().getTime(),
      applicants: [],
    };
  }
}
