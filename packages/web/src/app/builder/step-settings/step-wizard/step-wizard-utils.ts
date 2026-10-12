import { isNil } from '@activepieces/core-utils';
import { PieceMetadataModel } from '@activepieces/pieces-framework';
import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowTriggerType,
} from '@activepieces/shared';

function computeCompletion({
  step,
  pieceModel,
  hasTestError,
}: {
  step: FlowAction | FlowTrigger | undefined;
  pieceModel: PieceMetadataModel | undefined;
  hasTestError: boolean;
}): StepWizardCompletion {
  if (
    isNil(step) ||
    (step.type !== FlowActionType.PIECE && step.type !== FlowTriggerType.PIECE)
  ) {
    return { setup: false, configure: false, test: false };
  }
  const eventName =
    step.type === FlowActionType.PIECE
      ? step.settings.actionName
      : step.settings.triggerName;
  const selectedEvent = isNil(eventName)
    ? undefined
    : step.type === FlowActionType.PIECE
    ? pieceModel?.actions[eventName]
    : pieceModel?.triggers[eventName];
  const needsConnection =
    !isNil(pieceModel?.auth) &&
    !isNil(selectedEvent) &&
    (selectedEvent.requireAuth ?? true);
  const connection = step.settings.input?.['auth'];
  const hasConnection = !isNil(connection) && connection !== '';
  const setup = !isNil(selectedEvent) && (!needsConnection || hasConnection);
  const configure = setup && step.valid === true;
  const lastTestDate = step.settings.sampleData?.lastTestDate;
  const testIsCurrent =
    !isNil(lastTestDate) &&
    !((step.lastUpdatedDate ?? '') > lastTestDate) &&
    !hasTestError;
  return { setup, configure, test: configure && testIsCurrent };
}

function firstIncompleteTab(completion: StepWizardCompletion): StepWizardTab {
  if (!completion.setup) {
    return 'setup';
  }
  if (!completion.configure) {
    return 'configure';
  }
  return 'test';
}

export const stepWizardUtils = { computeCompletion, firstIncompleteTab };

export type StepWizardTab = 'setup' | 'configure' | 'test';

export type StepWizardCompletion = Record<StepWizardTab, boolean>;
