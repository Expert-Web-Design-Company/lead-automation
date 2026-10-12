import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece, PieceCategory } from '@activepieces/pieces-framework';
import { createOrUpdateLeadAction } from './lib/actions/create-or-update-lead';
import { ourCrmAuth } from './lib/auth';

export const ourCrm = createPiece({
  displayName: 'Our CRM',
  description: 'Send leads from ads and forms to the CRM without duplicates.',
  auth: ourCrmAuth,
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/new-core/http.svg',
  categories: [PieceCategory.SALES_AND_CRM],
  authors: ['tccmobile'],
  actions: [
    createOrUpdateLeadAction,
    createCustomApiCallAction({
      baseUrl: (auth) => (auth ? auth.props.base_url.trim().replace(/\/+$/, '') : ''),
      auth: ourCrmAuth,
      authMapping: async (auth) => ({
        Authorization: `Bearer ${auth.props.api_key}`,
      }),
    }),
  ],
  triggers: [],
});
