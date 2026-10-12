import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { newLeadTrigger } from './lib/triggers/new-lead';

export const googleAdsLeads = createPiece({
  displayName: 'Google Ads Lead Forms',
  description: 'Receive leads from Google Ads lead form assets the moment they are submitted.',
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/new-core/webhooks.svg',
  categories: [PieceCategory.MARKETING],
  authors: ['tccmobile'],
  actions: [],
  triggers: [newLeadTrigger],
});
