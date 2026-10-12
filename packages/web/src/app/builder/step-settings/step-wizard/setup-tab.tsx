import { isNil } from '@activepieces/core-utils';
import {
  FlowActionType,
  PieceAction,
  PieceTrigger,
} from '@activepieces/shared';
import { t } from 'i18next';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PieceIcon, stepsHooks } from '@/features/pieces';

import { PieceSettings } from '../piece-settings';
import { useStepSettingsContext } from '../step-settings-context';

const SetupTab = ({ step, flowId, readonly }: SetupTabProps) => {
  const { pieceModel } = useStepSettingsContext();
  const { stepMetadata } = stepsHooks.useStepMetadata({ step });
  const setOpenedPieceSelectorStepNameOrAddButtonId = useBuilderStateContext(
    (state) => state.setOpenedPieceSelectorStepNameOrAddButtonId,
  );
  const isAction = step.type === FlowActionType.PIECE;
  const eventName = isAction
    ? step.settings.actionName
    : step.settings.triggerName;
  const event = isNil(eventName)
    ? undefined
    : isAction
    ? pieceModel?.actions[eventName]
    : pieceModel?.triggers[eventName];

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>{t('App & event')}</Label>
        <div className="flex items-center gap-3 rounded-md border border-gray-6 bg-gray-1 p-3">
          {stepMetadata && (
            <PieceIcon
              logoUrl={stepMetadata.logoUrl}
              displayName={stepMetadata.displayName}
              showTooltip={false}
              border={false}
              size="md"
            />
          )}
          <div className="flex min-w-0 grow flex-col">
            <span className="truncate text-sm font-medium text-gray-12">
              {stepMetadata?.displayName}
            </span>
            <span className="truncate text-xs text-gray-11">
              {isAction ? t('Action event') : t('Trigger event')}:{' '}
              {event?.displayName ?? t('Not selected')}
            </span>
          </div>
          {!readonly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setOpenedPieceSelectorStepNameOrAddButtonId(step.name)
              }
            >
              {t('Change')}
            </Button>
          )}
        </div>
        {event?.description && (
          <p className="text-xs text-gray-11">{event.description}</p>
        )}
      </div>
      {pieceModel && isNil(pieceModel.auth) ? (
        <p className="text-sm text-gray-11">
          {t('This app does not need an account. Continue to configure it.')}
        </p>
      ) : (
        <PieceSettings
          step={step}
          flowId={flowId}
          readonly={readonly}
          section="connection"
        />
      )}
    </>
  );
};
SetupTab.displayName = 'SetupTab';
export { SetupTab };

type SetupTabProps = {
  step: PieceAction | PieceTrigger;
  flowId: string;
  readonly: boolean;
};
