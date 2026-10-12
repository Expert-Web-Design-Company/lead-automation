import { isNil } from '@activepieces/core-utils';
import {
  FlowTriggerType,
  PieceAction,
  PieceTrigger,
  flowStructureUtil,
} from '@activepieces/shared';
import { t } from 'i18next';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';

import { TestStepContainer } from '../../test-step';
import { PieceSettings } from '../piece-settings';
import { useStepSettingsContext } from '../step-settings-context';

import { SetupTab } from './setup-tab';
import { StepWizard } from './step-wizard';
import { stepWizardUtils } from './step-wizard-utils';

const PieceStepWizard = ({
  step,
  flowId,
  flowVersionId,
  projectId,
  readonly,
  saving,
}: PieceStepWizardProps) => {
  const { pieceModel } = useStepSettingsContext();
  const [liveStep, hasTestError, trigger, selectStepByName, exitStepSettings] =
    useBuilderStateContext((state) => [
      flowStructureUtil.getStep(step.name, state.flowVersion.trigger),
      !isNil(state.errorLogs[step.name]),
      state.flowVersion.trigger,
      state.selectStepByName,
      state.exitStepSettings,
    ]);
  const completion = stepWizardUtils.computeCompletion({
    step: liveStep,
    pieceModel,
    hasTestError,
  });
  const orderedSteps = flowStructureUtil.getAllSteps(trigger);
  const currentIndex = orderedSteps.findIndex(
    (candidate) => candidate.name === step.name,
  );
  const nextStep = orderedSteps
    .slice(currentIndex + 1)
    .find((candidate) => candidate.type !== FlowTriggerType.EMPTY);

  return (
    <StepWizard
      completion={completion}
      setupContent={
        <SetupTab step={step} flowId={flowId} readonly={readonly} />
      }
      configureContent={
        <PieceSettings
          step={step}
          flowId={flowId}
          readonly={readonly}
          section="fields"
        />
      }
      testContent={
        <TestStepContainer
          type={step.type}
          flowId={flowId}
          flowVersionId={flowVersionId}
          projectId={projectId}
          isSaving={saving}
        />
      }
      finishLabel={isNil(nextStep) ? t('Done') : t('Continue to next step')}
      onFinish={() =>
        isNil(nextStep) ? exitStepSettings() : selectStepByName(nextStep.name)
      }
    />
  );
};
PieceStepWizard.displayName = 'PieceStepWizard';
export { PieceStepWizard };

type PieceStepWizardProps = {
  step: PieceAction | PieceTrigger;
  flowId: string;
  flowVersionId: string;
  projectId: string;
  readonly: boolean;
  saving: boolean;
};
