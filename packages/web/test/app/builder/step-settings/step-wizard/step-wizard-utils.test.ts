import { PieceMetadataModel } from '@activepieces/pieces-framework';
import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowTriggerType,
} from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import { stepWizardUtils } from '@/app/builder/step-settings/step-wizard/step-wizard-utils';

const pieceWithAuth = {
  auth: { type: 'SECRET_TEXT' },
  actions: { create_or_update_lead: { name: 'create_or_update_lead' } },
  triggers: {},
} as unknown as PieceMetadataModel;

const pieceWithoutAuth = {
  auth: undefined,
  actions: {},
  triggers: { new_lead: { name: 'new_lead', requireAuth: false } },
} as unknown as PieceMetadataModel;

function actionStep(overrides: {
  actionName?: string;
  auth?: string;
  valid?: boolean;
  lastTestDate?: string;
  lastUpdatedDate?: string;
}): FlowAction {
  return {
    name: 'step_1',
    type: FlowActionType.PIECE,
    valid: overrides.valid ?? false,
    lastUpdatedDate: overrides.lastUpdatedDate,
    settings: {
      pieceName: '@activepieces/piece-our-crm',
      pieceVersion: '0.0.1',
      actionName: overrides.actionName,
      input: overrides.auth === undefined ? {} : { auth: overrides.auth },
      sampleData: overrides.lastTestDate
        ? { lastTestDate: overrides.lastTestDate }
        : undefined,
    },
  } as unknown as FlowAction;
}

function triggerStep(overrides: { valid?: boolean }): FlowTrigger {
  return {
    name: 'trigger',
    type: FlowTriggerType.PIECE,
    valid: overrides.valid ?? false,
    settings: {
      pieceName: '@activepieces/piece-google-ads-leads',
      pieceVersion: '0.0.1',
      triggerName: 'new_lead',
      input: {},
    },
  } as unknown as FlowTrigger;
}

describe('stepWizardUtils.computeCompletion', () => {
  it('setup is incomplete until an event is chosen', () => {
    const completion = stepWizardUtils.computeCompletion({
      step: actionStep({}),
      pieceModel: pieceWithAuth,
      hasTestError: false,
    });
    expect(completion).toEqual({ setup: false, configure: false, test: false });
  });

  it('setup needs a connection when the app requires one', () => {
    const withoutConnection = stepWizardUtils.computeCompletion({
      step: actionStep({ actionName: 'create_or_update_lead', valid: true }),
      pieceModel: pieceWithAuth,
      hasTestError: false,
    });
    const withConnection = stepWizardUtils.computeCompletion({
      step: actionStep({
        actionName: 'create_or_update_lead',
        auth: '{{connections.crm}}',
      }),
      pieceModel: pieceWithAuth,
      hasTestError: false,
    });
    expect(withoutConnection.setup).toBe(false);
    expect(withoutConnection.configure).toBe(false);
    expect(withConnection.setup).toBe(true);
  });

  it('setup is complete without a connection when the app needs none', () => {
    const completion = stepWizardUtils.computeCompletion({
      step: triggerStep({ valid: true }),
      pieceModel: pieceWithoutAuth,
      hasTestError: false,
    });
    expect(completion).toEqual({ setup: true, configure: true, test: false });
  });

  it('configure follows the form validity', () => {
    const completion = stepWizardUtils.computeCompletion({
      step: actionStep({
        actionName: 'create_or_update_lead',
        auth: '{{connections.crm}}',
        valid: false,
      }),
      pieceModel: pieceWithAuth,
      hasTestError: false,
    });
    expect(completion).toEqual({ setup: true, configure: false, test: false });
  });

  it('test is complete only when the last test is newer than the last edit and passed', () => {
    const base = {
      actionName: 'create_or_update_lead',
      auth: '{{connections.crm}}',
      valid: true,
    };
    const tested = stepWizardUtils.computeCompletion({
      step: actionStep({
        ...base,
        lastTestDate: '2026-10-13T10:00:00.000Z',
        lastUpdatedDate: '2026-10-13T09:00:00.000Z',
      }),
      pieceModel: pieceWithAuth,
      hasTestError: false,
    });
    const editedAfterTest = stepWizardUtils.computeCompletion({
      step: actionStep({
        ...base,
        lastTestDate: '2026-10-13T10:00:00.000Z',
        lastUpdatedDate: '2026-10-13T11:00:00.000Z',
      }),
      pieceModel: pieceWithAuth,
      hasTestError: false,
    });
    const failedTest = stepWizardUtils.computeCompletion({
      step: actionStep({ ...base, lastTestDate: '2026-10-13T10:00:00.000Z' }),
      pieceModel: pieceWithAuth,
      hasTestError: true,
    });
    expect(tested.test).toBe(true);
    expect(editedAfterTest.test).toBe(false);
    expect(failedTest.test).toBe(false);
  });

  it('non-piece steps are never reported complete', () => {
    const completion = stepWizardUtils.computeCompletion({
      step: { type: FlowActionType.CODE } as unknown as FlowAction,
      pieceModel: undefined,
      hasTestError: false,
    });
    expect(completion).toEqual({ setup: false, configure: false, test: false });
  });
});

describe('stepWizardUtils.firstIncompleteTab', () => {
  it.each([
    [{ setup: false, configure: false, test: false }, 'setup'],
    [{ setup: true, configure: false, test: false }, 'configure'],
    [{ setup: true, configure: true, test: false }, 'test'],
    [{ setup: true, configure: true, test: true }, 'test'],
  ] as const)('%j opens on %s', (completion, tab) => {
    expect(stepWizardUtils.firstIncompleteTab(completion)).toBe(tab);
  });
});
